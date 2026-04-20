<?php
/**
 * EAN Zoeker - OpenAI powered
 *
 * Twee zoekopties:
 * - Optie B: OpenAI GPT-4o met web_search, gefocust op Bol.com + fabrikantensites
 * - Optie C: Server scraped Bol.com zoekpagina + productpagina, AI extraheert specs
 */

// ========= CONFIG =========
$OPENAI_API_KEY = ' ';
$OPENAI_MODEL   = 'gpt-4o';
// ==========================

header('Content-Type: application/json; charset=utf-8');

$debug = [
    'timestamp'    => date('c'),
    'php_version'  => PHP_VERSION,
    'curl_enabled' => function_exists('curl_init'),
    'steps'        => [],
];

function logStep(&$debug, $step, $info = []) {
    $debug['steps'][] = array_merge([
        'step' => $step,
        'time' => microtime(true),
    ], $info);
}

// --- Input ---
$gtin   = isset($_GET['gtin'])   ? trim($_GET['gtin'])               : '';
$mode   = isset($_GET['mode'])   ? strtolower(trim($_GET['mode']))   : 'b';
$hint   = isset($_GET['hint'])   ? trim($_GET['hint'])               : '';
$lang   = isset($_GET['lang'])   ? strtoupper(trim($_GET['lang']))   : 'NL';

logStep($debug, 'input_ontvangen', compact('gtin', 'mode', 'hint', 'lang'));

// --- Validatie ---
if (!preg_match('/^\d{8,14}$/', $gtin)) {
    http_response_code(400);
    echo json_encode(['error' => 'Ongeldige EAN/GTIN (8-14 cijfers verwacht).', '_debug' => $debug]);
    exit;
}

if (empty($OPENAI_API_KEY)) {
    http_response_code(500);
    echo json_encode(['error' => 'OpenAI API-key niet ingesteld in proxy.php.', '_debug' => $debug]);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHP cURL extensie niet geïnstalleerd.', '_debug' => $debug]);
    exit;
}

// =========================================
// Generieke fetcher met logging
// =========================================
function fetchUrl($url, $headers, &$debug, $label, $postBody = null, $timeout = 60) {
    logStep($debug, "fetch_start_$label", [
        'url'      => $url,
        'method'   => $postBody === null ? 'GET' : 'POST',
        'headers'  => array_map(fn($h) => preg_replace('/(token|key|authorization|bearer):\s*\S+/i', '$1: ***', $h), $headers),
        'body_len' => $postBody === null ? 0 : strlen($postBody),
    ]);

    $start = microtime(true);
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_HEADER         => true,
        CURLOPT_ENCODING       => '',
    ];
    if ($postBody !== null) {
        $opts[CURLOPT_POST]       = true;
        $opts[CURLOPT_POSTFIELDS] = $postBody;
    }
    curl_setopt_array($ch, $opts);

    $response   = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $finalUrl   = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $curlErr    = curl_error($ch);
    $curlErrNo  = curl_errno($ch);
    curl_close($ch);

    $duration = round((microtime(true) - $start) * 1000);

    if ($response === false) {
        logStep($debug, "fetch_mislukt_$label", [
            'curl_error_nr' => $curlErrNo,
            'curl_error'    => $curlErr,
            'duur_ms'       => $duration,
        ]);
        return ['ok' => false, 'error' => "Verbindingsfout: $curlErr (code $curlErrNo)"];
    }

    $body = substr($response, $headerSize);

    logStep($debug, "fetch_klaar_$label", [
        'http_code'    => $httpCode,
        'final_url'    => $finalUrl,
        'duur_ms'      => $duration,
        'body_lengte'  => strlen($body),
        'body_preview' => mb_substr(strip_tags($body), 0, 200),
    ]);

    return [
        'ok'        => true,
        'http_code' => $httpCode,
        'body'      => $body,
        'final_url' => $finalUrl,
    ];
}

// =========================================
// OPTIE B: OpenAI + web search, bol.com-focus
// =========================================
function fetchOptieB($gtin, $hint, $lang, &$debug) {
    global $OPENAI_API_KEY, $OPENAI_MODEL;

    $langMap = ['NL' => 'Nederlands', 'EN' => 'English', 'DE' => 'Deutsch', 'FR' => 'Français'];
    $langName = $langMap[$lang] ?? 'Nederlands';

    $hintText = $hint ? "\nExtra context van de gebruiker: \"$hint\"" : '';

    $prompt = <<<PROMPT
Je bent een onderzoeker voor een Nederlands tech-magazine. Zoek op het web naar het product met EAN/GTIN: $gtin
$hintText

ZOEKSTRATEGIE:
- Zoek expliciet op Bol.com met: site:bol.com $gtin
- Raadpleeg ook Coolblue, MediaMarkt en de fabrikantensite
- Vergelijk specs tussen bronnen en meld tegenstrijdigheden
- Als je het product niet met zekerheid kunt identificeren: "found": false

BELANGRIJK: Verzin GEEN specificaties. Bij twijfel: null of "onbekend".
Beantwoord in het $langName.

Geef strikt geldige JSON terug (geen markdown, geen ```):

{
  "found": true,
  "confidence": "high" | "medium" | "low",
  "product_name": "...",
  "brand": "...",
  "model": "...",
  "category": "...",
  "description_short": "1-2 zinnen",
  "description_long": "3-6 zinnen",
  "key_features": ["...", "..."],
  "specifications": {
    "Algemeen": { "Specnaam": "Waarde" },
    "Andere groep": { ... }
  },
  "price_indication_eur": "€XX - €YY" of null,
  "release_year": "2024" of null,
  "bol_url": "https://www.bol.com/nl/nl/p/..." of null,
  "manufacturer_url": "https://..." of null,
  "warnings": ["Eventuele tegenstrijdigheden tussen bronnen"],
  "sources": [
    {"url": "...", "title": "...", "reliability": "high/medium/low"}
  ]
}

Als niet gevonden:
{
  "found": false,
  "reason": "Korte uitleg",
  "attempted_searches": ["query 1", "query 2"]
}
PROMPT;

    $payload = [
        'model' => $OPENAI_MODEL,
        'tools' => [[
            'type' => 'web_search',
            'filters' => [
                'allowed_domains' => [
                    'bol.com',
                    'coolblue.nl',
                    'mediamarkt.nl',
                ]
            ],
        ]],
        'input' => $prompt,
    ];

    $body = json_encode($payload);
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $OPENAI_API_KEY,
    ];

    logStep($debug, 'optieB_request', [
        'model' => $OPENAI_MODEL,
        'allowed_domains' => $payload['tools'][0]['filters']['allowed_domains'],
    ]);

    $result = fetchUrl('https://api.openai.com/v1/responses', $headers, $debug, 'openai_b', $body, 90);
    if (!$result['ok']) return ['error' => $result['error'], '_debug' => $debug];

    return parseOpenAIResponse($result['body'], $debug, 'B');
}

// =========================================
// OPTIE C: Bol.com scrapen + AI extractie
// =========================================
function fetchOptieC($gtin, $hint, $lang, &$debug) {
    global $OPENAI_API_KEY, $OPENAI_MODEL;

    // --- Stap 1: Bol.com zoekpagina ophalen ---
    $searchUrl = 'https://www.bol.com/nl/nl/s/?searchtext=' . urlencode($gtin);

    $browserHeaders = [
        'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language: nl-NL,nl;q=0.9,en;q=0.8',
        'Accept-Encoding: gzip, deflate, br',
        'Cache-Control: no-cache',
        'Pragma: no-cache',
        'Sec-Ch-Ua: "Google Chrome";v="131", "Chromium";v="131"',
        'Sec-Ch-Ua-Mobile: ?0',
        'Sec-Ch-Ua-Platform: "macOS"',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Upgrade-Insecure-Requests: 1',
    ];

    logStep($debug, 'optieC_stap1_zoekpagina_ophalen');
    $searchResult = fetchUrl($searchUrl, $browserHeaders, $debug, 'bol_zoek');

    if (!$searchResult['ok']) {
        return ['error' => 'Kon Bol.com zoekpagina niet bereiken: ' . $searchResult['error'], '_debug' => $debug];
    }

    if ($searchResult['http_code'] === 403 || $searchResult['http_code'] === 429) {
        logStep($debug, 'optieC_geblokkeerd', ['http' => $searchResult['http_code']]);
        return [
            'error' => "Bol.com blokkeert deze server (HTTP {$searchResult['http_code']}). Dit kan tijdelijk zijn of door bot-detectie. Probeer Optie B in plaats daarvan.",
            '_debug' => $debug,
        ];
    }

    $searchHtml = $searchResult['body'];

    if (stripos($searchHtml, 'access denied') !== false ||
        stripos($searchHtml, 'unusual traffic') !== false ||
        stripos($searchHtml, 'px-captcha') !== false ||
        stripos($searchHtml, 'perimeterx') !== false) {
        logStep($debug, 'optieC_captcha_detected');
        return [
            'error' => 'Bol.com toont een CAPTCHA of bot-challenge. Server-side scraping wordt geblokkeerd. Probeer Optie B.',
            '_debug' => $debug,
        ];
    }

    // --- Stap 2: Eerste productlink extraheren ---
    $productUrl = extractFirstProductUrl($searchHtml, $debug);

    if (!$productUrl) {
        logStep($debug, 'optieC_geen_product_gevonden');
        return [
            'error' => 'Geen productlink gevonden op de Bol.com zoekpagina. Mogelijk geeft Bol.com geen resultaat voor deze EAN, of de HTML-structuur is gewijzigd.',
            'search_url' => $searchUrl,
            '_debug' => $debug,
        ];
    }

    logStep($debug, 'optieC_productlink_gevonden', ['url' => $productUrl]);

    usleep(500000); // 0.5s beleefdheid

    // --- Stap 3: Productpagina ophalen ---
    $productHeaders = $browserHeaders;
    foreach ($productHeaders as &$h) {
        if (stripos($h, 'Sec-Fetch-Site:') === 0) $h = 'Sec-Fetch-Site: same-origin';
    }
    unset($h);
    $productHeaders[] = 'Referer: ' . $searchUrl;

    $productResult = fetchUrl($productUrl, $productHeaders, $debug, 'bol_product');
    if (!$productResult['ok']) {
        return ['error' => 'Kon productpagina niet ophalen: ' . $productResult['error'], '_debug' => $debug];
    }

    if ($productResult['http_code'] === 403 || $productResult['http_code'] === 429) {
        return [
            'error' => "Bol.com blokkeerde productpagina (HTTP {$productResult['http_code']}).",
            '_debug' => $debug,
        ];
    }

    $productHtml = $productResult['body'];
    $cleanContent = extractRelevantContent($productHtml, $debug);

    if (strlen($cleanContent) < 200) {
        logStep($debug, 'optieC_content_te_kort', ['lengte' => strlen($cleanContent)]);
        return [
            'error' => 'Te weinig bruikbare content uit productpagina (mogelijk JavaScript-rendered of geblokkeerd).',
            'content_preview' => mb_substr($cleanContent, 0, 300),
            '_debug' => $debug,
        ];
    }

    logStep($debug, 'optieC_content_gereed', [
        'clean_lengte' => strlen($cleanContent),
        'clean_preview' => mb_substr($cleanContent, 0, 300),
    ]);

    // --- Stap 4: AI extractie ---
    $langMap = ['NL' => 'Nederlands', 'EN' => 'English', 'DE' => 'Deutsch', 'FR' => 'Français'];
    $langName = $langMap[$lang] ?? 'Nederlands';
    $hintText = $hint ? "\nExtra context van de gebruiker: \"$hint\"" : '';

    $prompt = <<<PROMPT
Je krijgt HTML-content van een Bol.com productpagina voor EAN: $gtin$hintText

Haal hieruit de productgegevens en specificaties. Beantwoord in het $langName.

BELANGRIJK:
- Gebruik ALLEEN informatie die expliciet in de content staat
- Bij twijfel: "onbekend" of null — verzin niets
- Extraheer zoveel mogelijk specificaties, gegroepeerd per categorie

Geef strikt geldige JSON terug (geen markdown):

{
  "found": true,
  "confidence": "high" | "medium" | "low",
  "product_name": "...",
  "brand": "...",
  "model": "...",
  "category": "...",
  "description_short": "1-2 zinnen",
  "description_long": "3-6 zinnen",
  "key_features": ["...", "..."],
  "specifications": {
    "Algemeen": { "Specnaam": "Waarde" },
    "Andere groep": { ... }
  },
  "price_eur": "€XX,XX" of null,
  "rating": "4.5 van 5" of null,
  "review_count": 123 of null,
  "warnings": []
}

BOL.COM PRODUCTPAGINA CONTENT:
$cleanContent
PROMPT;

    $payload = [
        'model' => $OPENAI_MODEL,
        'input' => $prompt,
    ];

    $body = json_encode($payload);
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $OPENAI_API_KEY,
    ];

    $aiResult = fetchUrl('https://api.openai.com/v1/responses', $headers, $debug, 'openai_c', $body, 60);
    if (!$aiResult['ok']) return ['error' => $aiResult['error'], '_debug' => $debug];

    $parsed = parseOpenAIResponse($aiResult['body'], $debug, 'C');

    $parsed['bol_url'] = $productUrl;
    $parsed['bol_search_url'] = $searchUrl;

    return $parsed;
}

// =========================================
// Helper: eerste productlink extraheren
// =========================================
function extractFirstProductUrl($html, &$debug) {
    $patterns = [
        '#href="(/nl/nl/p/[^"]+/\d+/?)"#i',
        '#href="(/nl/p/[^"]+/\d+/?)"#i',
        '#href="(https://www\.bol\.com/nl/nl/p/[^"]+/\d+/?)"#i',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match_all($pattern, $html, $matches)) {
            logStep($debug, 'productlinks_gevonden', [
                'aantal' => count($matches[1]),
                'eerste_3' => array_slice($matches[1], 0, 3),
            ]);
            $link = $matches[1][0];
            if (strpos($link, 'http') !== 0) {
                $link = 'https://www.bol.com' . $link;
            }
            $link = strtok($link, '?');
            return $link;
        }
    }

    logStep($debug, 'geen_productlinks_in_html', [
        'html_lengte' => strlen($html),
        'html_snippet' => mb_substr(strip_tags($html), 0, 500),
    ]);
    return null;
}

// =========================================
// Helper: relevante content extraheren
// =========================================
function extractRelevantContent($html, &$debug) {
    $html = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $html);
    $html = preg_replace('#<style\b[^>]*>.*?</style>#is', '', $html);
    $html = preg_replace('#<svg\b[^>]*>.*?</svg>#is', '', $html);
    $html = preg_replace('#<noscript\b[^>]*>.*?</noscript>#is', '', $html);
    $html = preg_replace('#<iframe\b[^>]*>.*?</iframe>#is', '', $html);
    $html = preg_replace('#<!--.*?-->#s', '', $html);

    $mainContent = '';

    if (preg_match('#<main\b[^>]*>(.*?)</main>#is', $html, $m)) {
        $mainContent = $m[1];
        logStep($debug, 'main_tag_gevonden');
    } elseif (preg_match('#<body\b[^>]*>(.*?)</body>#is', $html, $m)) {
        $mainContent = $m[1];
        logStep($debug, 'body_fallback');
    } else {
        $mainContent = $html;
    }

    $mainContent = preg_replace('#<nav\b[^>]*>.*?</nav>#is', '', $mainContent);
    $mainContent = preg_replace('#<header\b[^>]*>.*?</header>#is', '', $mainContent);
    $mainContent = preg_replace('#<footer\b[^>]*>.*?</footer>#is', '', $mainContent);

    $text = strip_tags($mainContent, '<h1><h2><h3><h4><table><tr><td><th><dt><dd><li>');
    $text = preg_replace('/\s+/', ' ', $text);
    $text = preg_replace('/>\s+</', '><', $text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    if (mb_strlen($text) > 30000) {
        $text = mb_substr($text, 0, 30000) . "\n\n[Afgekapt op 30000 tekens]";
        logStep($debug, 'content_afgekapt');
    }

    return trim($text);
}

// =========================================
// Helper: OpenAI response parsen
// =========================================
function parseOpenAIResponse($rawBody, &$debug, $label) {
    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        return ['error' => "OpenAI (optie $label) gaf geen geldige JSON: " . json_last_error_msg(), '_debug' => $debug];
    }

    if (isset($decoded['error'])) {
        logStep($debug, "openai_{$label}_api_error", $decoded['error']);
        return [
            'error' => 'OpenAI API fout: ' . ($decoded['error']['message'] ?? 'onbekend'),
            '_debug' => $debug,
        ];
    }

    $outputText = '';
    $webSearches = [];
    $citations = [];

    if (isset($decoded['output']) && is_array($decoded['output'])) {
        foreach ($decoded['output'] as $item) {
            if (($item['type'] ?? '') === 'web_search_call') {
                $webSearches[] = [
                    'query'  => $item['action']['query'] ?? ($item['query'] ?? ''),
                    'status' => $item['status'] ?? '',
                ];
            } elseif (($item['type'] ?? '') === 'message' && isset($item['content'])) {
                foreach ($item['content'] as $content) {
                    if (($content['type'] ?? '') === 'output_text') {
                        $outputText .= $content['text'] ?? '';
                        if (isset($content['annotations'])) {
                            foreach ($content['annotations'] as $ann) {
                                if (($ann['type'] ?? '') === 'url_citation') {
                                    $citations[] = [
                                        'url'   => $ann['url']   ?? '',
                                        'title' => $ann['title'] ?? '',
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (empty($outputText) && isset($decoded['output_text'])) {
        $outputText = $decoded['output_text'];
    }

    logStep($debug, "openai_{$label}_output", [
        'text_len' => strlen($outputText),
        'web_searches' => count($webSearches),
        'citations' => count($citations),
    ]);

    $clean = $outputText;
    $clean = preg_replace('/^```(?:json)?\s*/m', '', $clean);
    $clean = preg_replace('/\s*```$/m', '', $clean);
    $clean = trim($clean);

    $parsedData = json_decode($clean, true);
    if (!is_array($parsedData) && preg_match('/\{[\s\S]*\}/', $clean, $m)) {
        $parsedData = json_decode($m[0], true);
    }

    return [
        '_debug'       => $debug,
        'data'         => $parsedData,
        'raw_output'   => $outputText,
        'web_searches' => $webSearches,
        'citations'    => $citations,
        'usage'        => $decoded['usage'] ?? null,
        'model'        => $decoded['model'] ?? null,
    ];
}

// =========================================
// Dispatch
// =========================================
if ($mode === 'b') {
    $result = fetchOptieB($gtin, $hint, $lang, $debug);
} elseif ($mode === 'c') {
    $result = fetchOptieC($gtin, $hint, $lang, $debug);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Ongeldige mode.', '_debug' => $debug]);
    exit;
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
