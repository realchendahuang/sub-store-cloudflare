interface GlobalStoreState {
  isLoading: boolean;
  isDefaultIcon: boolean;
  isFlowFetching: boolean;
  fetchResult: boolean;
  bottomSafeArea: number;
  isDarkMode: boolean;
  env: ENV;
  isDockerDeployment: boolean;
  isSimpleMode: boolean;
  isLeftRight: boolean;
  isIconColor: boolean;
  isEditorCommon: boolean;
  isSimpleReicon: boolean;
  showFloatingRefreshButton: boolean;
  savedPositions: any;
  subProgressStyle: any;
}

interface ENV {
  meta?: any;
  app?: string;
  runtime?: string;
  storage?: string;
  version?: string;
  feature?: any;
  backend?:
    | 'sing-box'
    | 'Stash'
    | 'QX'
    | 'Loon'
    | 'Surge'
    | 'ShadowRocket'
    | 'Egern'
    | 'Clash'
    | 'ClashMeta'
    | 'V2Ray'
    | 'Cloudflare'
    | 'Node';
}
