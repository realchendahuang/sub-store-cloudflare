export default {
  specificWord: {
    singleSub: "Single",
    collectionSub: "Collection",
    unknownType: "Unknown Type",
    unknownSource: "Unknown Source",
    unknown: "Unknown",
    all: "All",
    untagged: "Untagged",
    or: "or",
    type: "Type",
    none: "None",
    confirm: "Confirm"
  },
  globalNotify: {
    refresh: {
      succeed: "Refresh Completed",
      flowFailed: "Refresh of {name} failed!",
      failed: "Refresh Failed\n",
      loading: "Refreshing Data...",
      backendChanged: "Backend changed. Refreshing data...",
      rePwaing: "Resetting PWA cache...",
      rePwa: "PWA cache reset successfully. The page will refresh soon..."
    },
    request: {
      failedWithStatus: "Request failed: {status} {statusText}",
      failedStatusOnly: "Request failed: {status}",
      failed: "Request failed",
      network: "Network error or backend unavailable\n",
      noResponse: "No response received"
    }
  },
  navBar: {
    langSwitcher: {
      cellTitle: "Tap a language to switch",
      zh: "简体中文",
      en: "English",
      ru: "Русский",
      language: "Language"
    },
    actions: {
      refresh: "Refresh data",
      add: "Create subscription"
    },
    listSearch: {
      open: "Search",
      placeholder: "Name/tags/remarks (if shown)",
      clear: "Clear search",
      close: "Close search"
    },
    pagesTitle: {
      sub: "Subscriptions",
      my: "Settings",
      subEditor: "Subscription Editor",
      preview: "Preview",
      notFound: "404 Not Found"
    }
  },
  tabBar: {
    sub: "Subs",
    my: "Settings"
  },
  notFoundPage: {
    title: "Oops! URL Error!",
    desc: "Back to Home Page",
    backendDesc: "If you are seeing this, it is probably due to a routing interception issue on the front end of your browser. You can force a refresh to see it or use the link directly without affecting the use of this link."
  },
  subPage: {
    import: {
      label: "Import",
      succeed: "Successfully imported!",
      failed: "Failed to import!\n{e}",
      tipsTitle: "Import Subscription data",
      tipsContent: "On the Subscription management page, click on the Export icon button on the left/right slide of a subscription with more items."
    },
    addSubTitle: "Choose Subscription type",
    previewTitle: "Copy/Preview a subscription",
    tag: {
      addTagTitle: "Add Tag",
      tagPlaceholder: "Please enter tag name",
      addTagBtn: "+ New Tag"
    },
    emptySub: {
      title: "You have no Subscription yet",
      desc: "After adding you can enjoy the love of YM Peng",
      btn: "Create Subscription Now"
    },
    loadFailed: {
      title: "Load data failed",
      desc: "Please check MITM, Rewrite and others in Proxy Tool",
      btn: "Retry",
      doc: "Visit Sub-Store Docs",
      followOfficialChannel: "You can also follow Sub-Store official channel and join the group to ask questions",
      about: "Check the project & tutorial"
    },
    collectionItem: {
      noSub: "No subscription included",
      contain: "Included subs",
      containTag: "Included subscription tags"
    },
    actions: {
      openMenu: "Expand quick actions",
      closeMenu: "Collapse quick actions",
      openApp: "Open subscription website",
      preview: "Preview",
      copyLink: "Copy subscription link",
      refresh: "Refresh usage info",
      edit: "Edit",
      moreActions: "Open more actions",
      cloneConfig: "Clone config",
      openDownload: "Open download link",
      delete: "Delete",
      openTarget: "Open {name} subscription",
      copyTarget: "Copy {name} subscription"
    },
    subItem: {
      local: "Local subscription",
      loading: "Loading...",
      flow: "Usage / Total",
      showRemainingFlow: "Remaining / Total",
      expires: "Expires",
      remainingDays: "Remaining Reset Days",
      remainingDaysUnit: "",
      noRecord: "Refresh to get usage",
      noFlow: "No flow",
      noFlowInfo: "No flow info",
      flowError: "Failed to get usage",
      noExpiresInfo: "No expires info"
    },
    deleteItem: {
      title: "Delete",
      desc: "Are you sure to delete {displayName}? \nDeleted cannot be restored!",
      succeedNotify: "Successfully deleted!",
      btn: {
        confirm: "Delete",
        cancel: "Cancel"
      }
    },
    copyNotify: {
      succeed: "Successfully copied link!",
      failed: "Failed to copy subscription link!\n{e}"
    },
    copyConfigNotify: {
      loading: "Cloning...",
      succeed: "Successfully cloned config!",
      failed: "Failed to clone config!\n{e}"
    },
    exportConfigNotify: {
      loading: "Exporting...",
      succeed: "Successfully exported config!",
      failed: "Failed to exporte config!\n{e}"
    },
    panel: {
      general: "General",
      tips: {
        ok: "View Document",
        cancel: "Cancel",
        desc: "Some functions require parameters. Please check the document.",
        title: "Subscription Link Parameters",
        content: "https://github.com/sub-store-org/Sub-Store/wiki/%E9%93%BE%E6%8E%A5%E5%8F%82%E6%95%B0%E8%AF%B4%E6%98%8E"
      }
    },
    sort: {
      failed: "Failed to save sort order"
    }
  },
  editorPage: {
    groupingTips: {
      open: "Detail page grouping tips",
      title: "Detail page grouping",
      content: "If you do not like grouping, change it in My / More settings / Use grouping on detail pages.",
      goSettings: "Go to settings",
      cancel: "Cancel"
    },
    commonTips: {
      open: "Detail page common settings tips",
      title: "Detail page common settings",
      content: "You can adjust the display mode in My / More settings / Detail page common settings.",
      goSettings: "Go to settings",
      cancel: "Cancel"
    },
    subConfig: {
      btn: {
        compare: "Preview",
        save: "Save"
      },
      editorTabs: {
        display: "Display",
        content: "Content",
        actions: "Actions"
      },
      pop: {
        helpTitle: "Help",
        helpContent: "Proxy node actions will be executed in order, and you can drag and drop to sort them.\n\nThe preview switch is used to control whether the action takes effect in the instant preview.\n\nPlease note that node actions will be saved and take effect regardless of whether the preview switch is on or off.",
        helpBtn: "I Understand",
        errorTitle: "Submit Error!",
        errorBtn: "OK",
        succeedMsg: "Save Successfully!",
        deleteTitle: "Delete Confirm",
        deleteDes: "Do you really want to delete this action? Deleted action cannot be restored!",
        deleteConfirm: "Delete it",
        deleteCancel: "Cancel",
        clearTitle: "Clear Confirm",
        clearDes: "Do you really want to clear this content?",
        clearConfirm: "Clear it",
        clearCancel: "Cancel",
        leaveCancel: "Continue Editing",
        leaveConfirm: "Leave",
        leaveConfirmTitle: "Unsaved Changes",
        leaveContent: "Unsave changes will be lost without saving.\n\nDo you want to leave editing?",
        clickTag: {
          title: "Click Tag To Edit",
          content: "There is unsaved content in the input box. Now editing other tags will lose the unsaved content\n\nPlease confirm?",
          confirm: "confirm",
          cancel: "cancel"
        }
      },
      basic: {
        label: "Subscription Config",
        previewSwitch: "Preview",
        previewDisabledResponseOnlyTips: "Modify Response runs only before sending the download response. Instant preview does not execute it.",
        nodeActionsHelp: "Node Actions Help",
        name: {
          label: "Name",
          placeholder: "Unique name(do not include / )",
          isEmpty: "Name cannot be empty",
          isInvalid: "The name has been used or is invalid"
        },
        remark: {
          label: "Remarks",
          placeholder: "The remarks"
        },
        displayName: {
          label: "Display Name",
          placeholder: "The display name"
        },
        subInfoUrl: {
          label: "Sub Info URL",
          placeholder: "http(s) URL for fetching subscription usage info",
          tips: {
            title: "Sub Info URL",
            content: "Fill in an http(s) URL for subscription usage info. The Worker reads the response body or response headers subscription-userinfo/profile-web-page-url/plan-name.\n\nYou can also set flowUrl, flowUserAgent, and flowHeaders in the remote subscription URL hash parameters."
          }
        },
        subInfoUserAgent: {
          label: "Sub Info User-Agent",
          placeholder: "User-Agent for fetching subscription usage info"
        },
        tag: {
          label: "Tag(s)",
          placeholder: "Click on the right icon, The tag(s) (separated by comma) will be used for grouping."
        },
        subscriptionTags: {
          label: "Subscription Tag(s)",
          placeholder: "Click on the right icon, Include all subscriptions that contain one of these tag(s) (separated by comma)",
          tips: {
            title: "Collections and single subscriptions",
            content: "A collection includes:\n\n1. Single subscriptions matched by linked subscription tags\n\n2. Manually selected single subscriptions\n\nFor example, if linked tags are \"A, B\", every single subscription tagged with \"A\" or \"B\" will be included automatically."
          }
        },
        template: {
          label: "Rule Template",
          pickerTitle: "Select Rule Template",
          builtIn: "Built-in template",
          custom: "Custom template",
          tips: "Type: {type}\nTarget: {target}\n\nThe template writes proxy groups, rule providers, and routing rules into generated collection subscriptions."
        },
        source: {
          label: "Source",
          remote: "Remote URL",
          local: "Local",
          mergeSources: "Merge Sources",
          noMerge: "Disabled",
          localFirst: "Local Fist",
          remoteFirst: "Remote First"
        },
        url: {
          label: "URL",
          placeholder: "One http(s) remote subscription URL per line",
          tips: {
            importFromFile: "Import From File",
            fullScreenEdit: "Full Screen Editing",
            fullScreenEditCancel: "Exit Full Screen Editing",
            label: "Usage",
            title: "Subscription URL(s)",
            content: "Put one full http(s) remote subscription URL on each line. Multiple lines are fetched and merged.\n\nUsage info parameters:\n\nflowUrl: custom URL for subscription usage info; reads the response body or subscription-userinfo/profile-web-page-url/plan-name response headers\nflowUserAgent: User-Agent for usage info requests\nflowHeaders: request headers for usage info requests, as a URL-encoded one-line JSON string\nnoFlow: skip usage info\nhideExpire: hide expiration time\nshowRemaining: show remaining traffic instead of used traffic\n\nThe remote subscription User-Agent can be set on this page. Timeout and concurrency are configured on the My page.\n\nExample: https://example.com/sub?token=1#flowUrl=https%3A%2F%2Fexample.com%2Fuserinfo&showRemaining"
          },
          isEmpty: "URL cannot be empty",
          isIllegal: "Invalid URL"
        },
        subscriptions: {
          label: "Select included subscriptions",
          empty: "Please create a subscription first, then use the collection feature",
          none: "None"
        },
        content: {
          label: "Content",
          placeholder: "",
          validation: {
            action: "Validate nodes",
            checking: "Validating",
            empty: "Paste local node content first",
            success: "Parsed {count} node(s)",
            detail: "Protocol mix: {types}",
            failed: "No valid nodes parsed",
            noNodes: "No valid nodes parsed",
            importFailed: "File import failed",
            compareLoading: "Generating node comparison...",
            submitLoading: "Fetching subscription...",
            submitBusy: "Subscription is being fetched. Do not submit again."
          },
          tips: {
            title: "The content of the subscription",
            content: "Subscription content:\n\n1. Multiple single-line proxy protocols, Mihomo YAML, or JSON\n\n2. Complete Base64/YAML\n\n3. Common Surge, Loon, and Quantumult X single-line nodes\n\nCommon protocols are supported: ss, ssr, vmess, vless, trojan, hysteria, hysteria2, tuic, anytls, http, socks5, wireguard"
          }
        },
        icon: {
          label: "Icon",
          placeholder: "Click on the left or top icon, fill in the icon link from the icon library, do not use jpg."
        },
        isIconColor: {
          label: "Custom Icon Use Original Color"
        },
        ignoreFailedRemoteSub: {
          label: "Sub Failure Handling",
          disabled: "Strict Errors",
          disabledDesc: "Fail immediately and show a notification when subscription processing errors occur.",
          disabledNote: "fail and notify",
          enabled: "Skip Remote + Notify",
          enabledDesc: "Skip failed remote subscriptions and show a notification; other errors still fail.",
          enabledNote: "other errors still fail",
          quiet: "Skip Remote Silently",
          quietDesc: "Skip failed remote subscriptions without showing a notification; other errors still fail.",
          quietNote: "other errors still fail",
          fallbackNotify: "Empty on Error + Notify",
          fallbackNotifyDesc: "If subscription processing hits any error, return an empty result and show a notification.",
          fallbackNotifyNote: "return empty result",
          fallbackQuiet: "Empty on Error Silently",
          fallbackQuietDesc: "If subscription processing hits any error, return an empty result without showing a notification.",
          fallbackQuietNote: "return empty result"
        },
        ua: {
          label: "User-Agent",
          placeholder: "The User-Agent for downloading resource(s)",
          placeholderDisabled: "Disable custom UA when passing through",
          tips: {
            title: "Uses the global UA by default",
            content: "Try using a client User-Agent such as clash-verge/v2.4.6 or v2rayNG so providers may return more protocols. Adjust it to match the client version you actually use."
          }
        },
        subUserinfo: {
          label: "Subscription-Userinfo",
          placeholder: "upload=...; download=...; total=...",
          tips: {
            title: "Manual subscription usage info",
            content: "Fill in subscription-userinfo style usage info. To query usage from a separate URL, set flowUrl in the remote subscription URL hash parameters.\n\nExample:\n\nupload=1024; download=10240; total=102400; expire=4115721600; reset_day=14; plan_name=VIP1; app_url=http%3A%2F%2Fa.com\n\n1. app_url is shown as a clickable link. Encode the URL first.\n\n2. plan_name is shown as the plan name.\n\n3. reset_day means remaining days until traffic reset.\n\nManual values are parsed together with remote subscription response headers."
          }
        },
        firstSubFlow: {
          label: "Pass Through Single Subscription Traffic Info",
          tips: {
            title: "Pass Through Single Subscription Traffic Info",
            content: "By default, the first single subscription traffic info is passed through.\n\nTo merge traffic info from all single subscriptions in the collection, use the script at https://t.me/zhetengsha/3070",
            okText: "View"
          }
        },
        passThroughUA: {
          label: "Pass Through Request User-Agent",
          warning: "Pass Through Request User-Agent and Custom UA cannot be enabled at the same time"
        },
        proxy: {
          label: "Proxy/Policy",
          placeholder: "The proxy/node/policy for downloading resource(s)"
        }
      },
      commonOptions: {
        label: "Common Settings",
        useless: {
          label: "Remove Useless Nodes",
          disabled: "Retain",
          enabled: "Remove"
        },
        udp: {
          label: "UDP Relay",
          default: "Default",
          enabled: "Force Enable",
          disabled: "Force Disable"
        },
        scert: {
          label: "Skip TLS Verification",
          default: "Default",
          enabled: "Force Enable",
          disabled: "Force Disable"
        },
        tfo: {
          label: "TCP Fast Open",
          default: "Default",
          enabled: "Force Enable",
          disabled: "Force Disable"
        },
        "vmess aead": {
          label: "Vmess AEAD",
          default: "Default",
          enabled: "Force Enable",
          disabled: "Force Disable"
        }
      },
      actions: {
        label: "Node Actions",
        addAction: {
          title: "Add an action",
          cancel: "Cancel",
          confirm: "Confirm"
        },
        pasteAction: {
          label: "Import Data From Clipboard",
          placeholder: "Failed to read the clipboard automatically, please paste the data manually in this text box.",
          copied: "Action data copied. It can be imported later.",
          importFailed: "Import failed {e}",
          sourceMismatch: "File actions and subscription actions are not interchangeable",
          invalidData: "Invalid data format"
        },
        enable: "Enable",
        disable: "Disable"
      },
      nodeActions: {
        "Flag Operator": {
          label: "Flags Options",
          des: "Mode",
          options: [
            "Add Flag",
            "Remove Flag"
          ],
          twOptions: [
            "⇒ 🇨🇳",
            "⇒ 🇼🇸",
            "Unchanged"
          ],
          tipsTitle: "flags Tips",
          tipsDes: "Flag operation instructions",
          twWhenPrefix: "When detected as",
          twWhenSuffix: "",
          disclaimer: "Disclaimer: this action only replaces emoji flags for display and has no political meaning."
        },
        "Sort Operator": {
          label: "Node Sort",
          des: "Order",
          options: [
            "Ascending",
            "Descending",
            "Random"
          ],
          tipsTitle: "sort Tips",
          tipsDes: "Description of node sorting operation"
        },
        "Resolve Domain Operator": {
          label: "Resolve Domain",
          des: "Providers(can be controlled by the node field \"_no-resolve\")",
          options: [
            "Google",
            "Cloudflare",
            "Ali",
            "Tencent",
            "Custom"
          ],
          types: [
            "IPv4",
            "IPv6"
          ],
          filters: [
            "Disabled",
            "Remove Failed",
            "IP Only",
            "IPv4 Only",
            "IPv6 Only"
          ],
          cache: [
            "Enabled",
            "Disabled"
          ],
          concurrency: "Request Concurrency",
          concurrencyPlaceholder: "Default 10. Keep proxy apps at 20 or less",
          customDohPlaceholder: "DoH only",
          edns: "EDNS (Google, Ali, Tencent, and custom DoH carry this parameter; it may affect results)",
          ednsPlaceholder: "Enter a plain IP. Default: 223.6.6.6",
          resolveType: "Resolve type (IPv6 supports IP4P)",
          filterResult: "Filter result",
          unsupported: "{provider} does not support {type}",
          ip4pTitle: "IP4P address format",
          ip4pContent: "When IPv6 is selected, IP4P addresses are converted automatically.\n\nFrom NATMap, the IPv4 address and port are encoded in DNS AAAA records.\n\nUse case: STUN NAT traversal without a public server.",
          ip4pOk: "Learn more",
          tipsTitle: "domain Tips",
          tipsDes: "Operation instructions for node domain name resolution"
        },
        "Region Filter": {
          label: "Region Filter",
          des: [
            "Region",
            "Mode"
          ],
          modeOptions: [
            "Retain",
            "Remove"
          ],
          options: [
            "🇭🇰 HK",
            "🇨🇳 TW",
            "🇸🇬 SG",
            "🇯🇵 JP",
            "🇬🇧 UK",
            "🇺🇸 US",
            "🇩🇪 DE",
            "🇰🇷 KR"
          ],
          tipsTitle: "Region Filter Tips",
          tipsDes: "Region filter operating instructions"
        },
        "Type Filter": {
          label: "Node Type Filter",
          des: [
            "Type",
            "Mode"
          ],
          modeOptions: [
            "Retain",
            "Remove"
          ],
          options: [
            "Shadowsocks",
            "ShadowsocksR",
            "VMess",
            "VLESS",
            "Trojan",
            "HTTP(s)",
            "HTTP/2 CONNECT",
            "SOCKS5",
            "Snell",
            "TUIC",
            "Hysteria",
            "Hysteria 2",
            "Juicity",
            "mieru",
            "sudoku",
            "MASQUE",
            "AnyTLS",
            "TrustTunnel",
            "OpenVPN",
            "GOST Relay",
            "Tailscale",
            "WireGuard",
            "SSH",
            "External Proxy Program",
            "Direct"
          ],
          tipsTitle: "Node Type Filter Tips",
          tipsDes: "Node type filter Operation Description"
        },
        "Regex Filter": {
          label: "Regex Filter",
          des: [
            "Regular Expressions",
            "Mode"
          ],
          options: [
            "Retain",
            "Remove"
          ],
          placeholder: [
            "Regular Expressions"
          ],
          tipsTitle: "Regex Filter Tips",
          tipsDes: "Regular filtering operation instructions"
        },
        "Regex Sort Operator": {
          label: "Regex Sort",
          des: [
            "Regular Expressions",
            "Sort of Unmatched Nodes"
          ],
          options: [
            "Ascending",
            "Descending",
            "Original"
          ],
          placeholder: [
            "Regular Expressions"
          ],
          tipsTitle: "Regex Sort Tips",
          tipsDes: "Regular sorting operation instructions"
        },
        "Regex Delete Operator": {
          label: "Regex Delete",
          des: [
            "Regular Expressions"
          ],
          placeholder: [
            "Regular Expressions"
          ],
          tipsTitle: "Regex Delete Tips",
          tipsDes: "Regular deletion operation instructions"
        },
        "Regex Rename Operator": {
          label: "Regex Rename",
          des: [
            "Regular Expressions"
          ],
          placeholder: [
            "Regular Expressions",
            "Replace with"
          ],
          tipsTitle: "Regex Rename Tips",
          tipsDes: "Regular renaming operation instructions"
        },
        "Handle Duplicate Operator": {
          label: "Handle Duplicate",
          action: {
            options: [
              "Rename",
              "Delete"
            ],
            des: "Operate"
          },
          position: {
            options: [
              "Prefix",
              "Suffix"
            ],
            des: "Number Position"
          },
          template: {
            des: "Number Format",
            placeholder: "Serial number display format, separated by spaces"
          },
          link: {
            des: "Separator",
            placeholder: "The connector between the node name and the sequence number"
          },
          field: {
            des: "Deduplication Field(supports multi-field concatenation and lodash get syntax)",
            placeholder: "Field for deduplication, e.g. node name, please enter name"
          },
          tipsTitle: "Handle Duplicate Tips",
          tipsDes: "Node deduplication operation instructions"
        }
      },
      sourceNamePicker: {
        title: "Select Subscription Name",
        cancel: "Cancel",
        confirm: "Confirm",
        emptyTips: "Subscription not found? Click to add a subscription"
      }
    }
  },
  myPage: {
    profile: {
      desc: "Subscription aggregation, node processing, and cloud rule templates",
      runtime: "Runtime",
      storage: "Storage",
      version: "Version"
    },
    backup: {
      title: "Backup and Restore",
      desc: "Export and restore sources, collections, rule templates, and request settings.",
      export: "Backup",
      restore: "Restore",
      restoreTitle: "Restore backup",
      restoreContent: "Restoring will overwrite sources, collections, rule templates, and settings with the same names. Export a current backup first."
    },
    templates: {
      title: "Rule Templates",
      importFile: "Import file",
      create: "New",
      builtIn: "Built-in",
      custom: "Custom",
      editTitle: "Edit rule template",
      importTitle: "Import rule template",
      idPlaceholder: "Template ID, e.g. custom-mihomo",
      namePlaceholder: "Display name, e.g. Custom Mihomo",
      target: "Output target",
      targetPickerTitle: "Select output target",
      save: "Save template",
      validationRequired: "Template ID and content are required",
      saveSucceed: "Template saved",
      saveFailed: "Failed to save template\n{e}",
      deleteTitle: "Delete template",
      deleteContent: "Delete template {name}?",
      deleteSucceed: "Template deleted"
    },
    request: {
      title: "Request Settings",
      defaultUserAgent: "Default User-Agent",
      defaultFlowUserAgent: "Usage-info User-Agent",
      defaultTimeout: "Request timeout in milliseconds",
      backendRequestConcurrency: "Remote subscription concurrency",
      backendRequestConcurrencyWaitTime: "Wait time between concurrent requests in milliseconds",
      summary: "Remote subscription concurrency is {concurrency}; timeout is {timeout}ms."
    },
    btn: {
      cancel: "Cancel",
      edit: "Edit",
      save: "Save",
      delete: "Delete"
    },
    notify: {
      save: {
        succeed: "Saved",
        failed: "Save failed",
        configLoadFailed: "Failed to load settings",
        configUpdateFailed: "Failed to update settings",
        themeLoading: "Switching theme...",
        themeFailed: "Failed to switch theme"
      },
      restore: {
        succeed: "Restored",
        failed: "Restore failed",
        failedWithError: "Restore failed\n{e}"
      }
    }
  },
  comparePage: {
    title: "Instant Preview",
    loading: "Generating node comparison...",
    filePreviewCopyLabel: "Click to copy and use as an external resource:",
    filePreviewLoadFailed: "Load failed: {e}",
    filePreviewCopied: "Copied link: {url}",
    remain: {
      title: "remain nodes",
      beforeIndicator: "before",
      afterIndicator: "after",
      indicatorDisabledTips: "No data available for {side}"
    },
    nodeNames: {
      entry: "All names",
      title: "{side} all node names",
      descriptionBefore: "Copy all node names, or copy a prompt that asks AI to summarize reusable naming rules. Apply the result with regex rename rules. Reference: ",
      aiLink: "Node naming reference",
      copyAll: "Copy all names",
      copyPrompt: "Copy prompt",
      copyAllSucceed: "Node names copied",
      copyPromptSucceed: "Prompt copied",
      copyFailed: "Failed to copy\n{e}"
    },
    divider: "Following is filtered nodes",
    filter: {
      title: "filtered nodes"
    },
    tableHead: {
      name: "Name&Server",
      udp: "UDP",
      "skip-cert-verify": "SCV",
      tfo: "TFO",
      aead: "AEAD"
    },
    nodeInfo: {
      loading: "Getting Node Info...",
      loadFailed: "Get Node Info Failed",
      ipApi: {
        title: "IP-API",
        loading: "Loading IP API details...",
        loadFailed: "Failed to load IP API details",
        retry: "Retry"
      },
      node: {
        title: "Node Info",
        server: "Server",
        password: "Password",
        UUID: "UUID"
      }
    }
  },
  codeEditor: {
    copiedLength: "Copied characters: {count}",
    cleared: "Cleared",
    pastedLength: "Pasted characters: {count}",
    clipboardFailed: "Failed to read clipboard: available on localhost/HTTPS or after granting permission"
  },
  iconCollectionPage: {
    iconCollection: "Icon Collection",
    iconCollectionPlaceholder: "Please input icon collection url",
    iconName: "Icon Name",
    iconNamePlaceholder: "Please input icon name",
    errorIconCollectionUrlTips: "Please enter correct url",
    copySuccessTips: "The icon url has been copied",
    loadingTitle: "Loading icons",
    loadingDesc: "Fetching the icon collection for the first open.",
    emptyCollectionTitle: "No icon data yet",
    emptyCollectionDesc: "Please manually refresh or select a different icon collection",
    loadFailedTitle: "Failed to load icons",
    loadFailedDesc: "Check the network, proxy, or collection URL and try again.",
    refreshBtn: "Manual refresh",
    retryBtn: "Retry",
    selectCollectionBtn: "Select a icon collection",
    more: "More",
    useCustomIconCollection: "Use Custom Icon Collection",
    resetDefaultIconCollection: "Reset Default",
    collectionPicker: {
      title: "Select a icon collection",
      cancel: "Cancel",
      confirm: "Confirm"
    }
  }
};
