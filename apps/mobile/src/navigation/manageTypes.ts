export type ManageStackParamList = {
  ManageHome: undefined;
  DistributorList: undefined;
  DistributorDetail: { distributorId: string; distributorName: string };
  AddSeller: undefined;
  ResetPassword: { distributorId: string; distributorName: string };
  CountryList: undefined;
  AddCountry: undefined;
  AddEditProduct: { productId?: string };
  PostNews: undefined;
  AddArticle: undefined;
  PendingPayments: undefined;
};