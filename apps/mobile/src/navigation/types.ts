export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Shop: undefined;
  Team: undefined;
  Account: undefined;
  Manage: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  News: undefined;
  Articles: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
