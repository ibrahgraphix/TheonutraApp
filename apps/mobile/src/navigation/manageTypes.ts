export type ManageStackParamList = {
  ManageHome: undefined;
  DistributorList: undefined;
  AddSeller: undefined;
  ResetPassword: { distributorId: string; distributorName: string };
  AddEditProduct: { productId?: string };
  PostNews: undefined;
  PendingPayments: undefined;
};
