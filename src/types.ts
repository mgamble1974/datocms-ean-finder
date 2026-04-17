export interface IcecatFeature {
  Feature: {
    Name: string;
    Unit?: { Symbol: string };
  };
  Value: string;
  PresentationValue: string;
}

export interface IcecatFeatureGroup {
  FeatureGroup: { Name: string };
  Features: IcecatFeature[];
}

export interface IcecatProduct {
  GeneralInfo: {
    IcecatId?: number;
    Title: string;
    Brand: string;
    BrandLogo?: string;
    BrandPartCode?: string;
    Image?: {
      HighImg?: string;
      LowImg?: string;
      ThumbImg?: string;
    };
    Description?: {
      ShortDesc?: string;
      LongDesc?: string;
    };
  };
  FeaturesGroups?: IcecatFeatureGroup[];
  Gallery?: Array<{ HighPic?: string; LowPic?: string; ThumbPic?: string }>;
}

export interface IcecatResponse {
  data?: IcecatProduct;
  msg?: string;
  status?: number;
}

export interface Params {
  [key: string]: unknown;
  icecatUsername?: string;
  language?: string;
  productNameField?: string;
  brandField?: string;
  imageField?: string;
  specsJsonField?: string;
}
