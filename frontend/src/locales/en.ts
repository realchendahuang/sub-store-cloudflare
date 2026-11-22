export default {
  specificWord: {
    singleSub: "Source",
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
      backendChanged: "The Worker was updated. Refreshing data..."
    },
    request: {
      failedWithStatus: "Request failed: {status} {statusText}",
      failedStatusOnly: "Request failed: {status}",
      failed: "Request failed",
      network: "Network error or the Worker API is unreachable\n",
      noResponse: "No response received",
      unauthorized: "The admin token is invalid or expired. Please enter it again."
    }
  },
  navBar: {
    langSwitcher: {
      cellTitle: "Tap a language to switch",
      zh: "简体中文",
      en: "English",
      language: "Language"
    },
    actions: {
      back: "Back",
      refresh: "Refresh data",
      add: "Create"
    },
    listSearch: {
      open: "Search",
      placeholder: "Name/tags/remarks (if shown)",
      clear: "Clear search",
      close: "Close search"
    },
    pagesTitle: {
      sub: "Subscriptions",
      tools: "Tools",
      my: "Settings",
      subEditor: "Edit Subscription",
      sourceCreate: "Create Source",
      sourceEdit: "Edit Source",
      collectionCreate: "Create Collection",
      collectionEdit: "Edit Collection",
      preview: "Preview",
      notFound: "404 Not Found"
    }
  },
  tabBar: {
    sub: "Subscriptions",
    tools: "Tools",
    my: "Settings"
  },
  toolsPage: {
    resourceTypes: {
      source: "Source",
      collection: "Collection",
      template: "Rule template",
      share: "Share link"
    },
    converter: {
      title: "One-shot conversion",
      desc: "Paste nodes, a subscription, or rules and convert them without saving anything.",
      kind: "Input type",
      target: "Output target",
      proxy: "Nodes / subscription",
      rule: "Rules",
      input: "Paste content to convert",
      output: "Converted result",
      run: "Convert",
      copy: "Copy result",
      stats: "Parsed {parsed} · emitted {emitted} · skipped {skipped}"
    },
    shares: {
      title: "Scoped share links",
      desc: "Create a revocable, optionally expiring link for one source or collection, optionally restricted to one output target.",
      resourceType: "Resource type",
      resource: "Resource",
      noResource: "Nothing to share yet",
      target: "Output target",
      autoTarget: "Auto (by client UA)",
      expires: "Lifetime (hours, 0 = never expires)",
      expiresError: "Enter a whole number from 0 to {max}",
      create: "Create link",
      createdTitle: "Link created",
      createdHint: "Copy it now. The token is shown only once.",
      copy: "Copy",
      empty: "No scoped links",
      enabled: "Enabled",
      disabled: "Disabled",
      expiresAt: "Expires {time}",
      never: "Never expires",
      disable: "Disable",
      enable: "Enable"
    },
    recycle: {
      title: "Recycle bin",
      desc: "Keeps the 50 most recently deleted items. Restoring never overwrites an existing ID.",
      empty: "Recycle bin is empty",
      deletedAt: "Deleted {time}",
      restore: "Restore",
      purge: "Delete permanently",
      purgeTitle: "Delete permanently",
      purgeContent: "Permanently delete {name}? This cannot be undone."
    },
    notify: {
      converted: "Conversion complete",
      copied: "Copied",
      shareCreated: "Share link created",
      restored: "Restored",
      failed: "Operation failed\n{e}"
    }
  },
  notFoundPage: {
    title: "Oops! URL Error!",
    desc: "Back to Home Page",
    backendDesc: "The browser's page router intercepted this link. Force-refresh the page or open the link directly; the link itself still works."
  },
  subPage: {
    import: {
      label: "Import",
      succeed: "Successfully imported!",
      failed: "Failed to import!\n{e}",
      tipsTitle: "Import subscription config",
      tipsContent: "Import a JSON config for one source or collection. Use backup restore on the Settings page for full config migration."
    },
    addSubTitle: "Choose what to create",
    previewTitle: "Preview or copy subscription",
    tag: {
      addTagTitle: "Add Tag",
      tagPlaceholder: "Please enter tag name",
      addTagBtn: "+ New Tag"
    },
    emptySub: {
      title: "No subscriptions yet",
      desc: "Add a remote subscription or local node text to start aggregating.",
      btn: "Create subscription"
    },
    onboarding: {
      welcome: "First run",
      title: "Create your first subscription link in three steps",
      desc: "Your configuration stays in your Cloudflare D1 database. Add a source, create a collection, then copy a client link.",
      addSource: "Add a remote subscription or local node text",
      addCollection: "Review the default Daily collection or create one",
      copyLink: "Copy a Mihomo, sing-box, or other download link",
      createSource: "Add the first source",
      openGuide: "Open the five-minute guide",
      step2: "Next step · 2/3",
      collectionTitle: "Create a collection",
      collectionDesc: "If the default Daily collection was removed, create a collection to combine, deduplicate, and apply a routing template.",
      createCollection: "Create collection"
    },
    loadFailed: {
      title: "Unable to load data",
      desc: "If you just deployed the app, enter the admin token first. Otherwise, check the Worker API and network connection.",
      btn: "Retry",
      tokenLabel: "Admin token",
      tokenPlaceholder: "Enter SUB_STORE_ADMIN_TOKEN",
      saveAndRetry: "Save and retry",
      doc: "Open deployment docs",
      followOfficialChannel: "Check the project docs before debugging the deployment.",
      about: "Open project docs"
    },
    collectionItem: {
      noSub: "All enabled sources",
      contain: "Included sources"
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
      cloneConfig: "Clone",
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
      remainingDays: "Days until reset",
      remainingDaysUnit: "",
      noRecord: "Refresh to get usage",
      noFlow: "Usage info disabled",
      noFlowInfo: "No flow info",
      flowError: "Failed to get usage",
      noExpiresInfo: "No expires info"
    },
    deleteItem: {
      title: "Delete",
      desc: "Delete {displayName}?\nIt will be moved to the recycle bin on the Tools page.",
      succeedNotify: "Successfully deleted!",
      btn: {
        confirm: "Delete",
        cancel: "Cancel"
      }
    },
    copyNotify: {
      succeed: "Successfully copied link!",
      failed: "Failed to copy subscription link!\n{e}",
      linkFailed: "Failed to get the subscription link. Please try again later."
    },
    copyConfigNotify: {
      loading: "Cloning...",
      succeed: "Successfully cloned config!",
      failed: "Failed to clone config!\n{e}"
    },
    exportConfigNotify: {
      loading: "Exporting...",
      succeed: "Successfully exported config!",
      failed: "Failed to export config!\n{e}"
    },
    panel: {
      general: "General",
      tips: {
        ok: "View Document",
        cancel: "Cancel",
        desc: "Download links can choose an output target and support temporary url/content/ua parameters.",
        title: "Subscription Link Parameters",
        content: "https://github.com/realchendahuang/sub-store-cloudflare#deployment"
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
      content: "The editor is grouped into display, content, and actions so the source, collection, node processing, and routing template stay easy to maintain.",
      goSettings: "OK",
      cancel: "Cancel"
    },
    commonTips: {
      open: "Detail page common settings tips",
      title: "Detail page common settings",
      content: "Common settings generate node actions for invalid-node cleanup and batch options such as UDP, TFO, and skip TLS verification.",
      goSettings: "OK",
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
        leaveContent: "Unsaved changes will be lost.\n\nLeave the editor anyway?",
        clickTag: {
          title: "Click Tag To Edit",
          content: "There is unsaved content in the input box. Now editing other tags will lose the unsaved content\n\nPlease confirm?",
          confirm: "Confirm",
          cancel: "Cancel"
        }
      },
      basic: {
        label: "Subscription Config",
        previewSwitch: "Preview",
        previewDisabledResponseOnlyTips: "Modify Response runs only before sending the download response. Instant preview does not execute it.",
        nodeActionsHelp: "Node Actions Help",
        name: {
          label: "ID",
          placeholder: "Lowercase letters, numbers, underscores, or hyphens",
          isEmpty: "ID is required",
          isInvalid: "ID is already used or does not match the 1–64 character format"
        },
        remark: {
          label: "Remarks",
          placeholder: "Optional note shown on the card"
        },
        displayName: {
          label: "Display Name",
          placeholder: "Name shown in the list"
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
          placeholder: "Comma-separated tags used for grouping"
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
          localFirst: "Local First",
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
            content: "Put one full http(s) remote subscription URL on each line. Multiple lines are fetched and merged.\n\nUsage info parameters:\n\nflowUrl: custom URL for subscription usage info; reads the response body or subscription-userinfo/profile-web-page-url/plan-name response headers\nflowUserAgent: User-Agent for usage info requests\nflowHeaders: request headers for usage info requests, as a URL-encoded one-line JSON string\nnoFlow: skip usage info\nhideExpire: hide expiration time\nshowRemaining: show remaining traffic instead of used traffic\n\nThe remote subscription User-Agent can be set on this page. Timeout and concurrency are configured on the Settings page.\n\nExample: https://example.com/sub?token=1#flowUrl=https%3A%2F%2Fexample.com%2Fuserinfo&showRemaining"
          },
          isEmpty: "URL cannot be empty",
          isIllegal: "Invalid URL"
        },
        subscriptions: {
          label: "Included sources",
          empty: "Create a source before creating a collection",
          none: "None",
          allEnabled: "All enabled sources"
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
          placeholder: "Icon image URL (PNG or SVG)"
        },
        isIconColor: {
          label: "Custom Icon Use Original Color"
        },
        ignoreFailedRemoteSub: {
          label: "Source failure handling",
          disabled: "Fail the collection",
          disabledNote: "stop when any source fails",
          skip: "Skip failed sources",
          skipNote: "keep the remaining available sources"
        },
        ua: {
          label: "User-Agent",
          placeholder: "User-Agent for fetching this source; blank uses the default",
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
          label: "Use the first source's usage info",
          tips: {
            title: "Use the first source's usage info",
            content: "A collection passes through usage info from the first source by default. To show aggregate usage, fill subscription-userinfo manually on the related source or use a dedicated flowUrl.",
            okText: "OK"
          }
        },
        passThroughUA: {
          label: "Pass Through Request User-Agent",
          warning: "Pass Through Request User-Agent and Custom UA cannot be enabled at the same time"
        },
        proxy: {
          label: "Proxy/Policy",
          placeholder: "Proxy or policy for fetching remote resources; blank uses the default"
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
        disable: "Disable",
        script: {
          freeVerified: "Cloudflare Free verified",
          personal: "Personal build-time script",
          unavailable: "This script is not available in the deployed Worker. Redeploy a Worker that includes it.",
          limit: "A source or collection can use at most two script actions"
        }
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
        },
        "Script Filter": {
          label: "Build-time Script Filter",
          tipsTitle: "Script Filter",
          tipsDes: "Runs a filter already bundled with the Worker. No script text is evaluated from the browser, D1, or a remote URL."
        },
        "Script Operator": {
          label: "Build-time Script Operator",
          tipsTitle: "Script Operator",
          tipsDes: "Runs a node transformer already bundled with the Worker. Built-ins are Free-verified; personal scripts require redeployment."
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
      desc: "Subscription aggregation, node processing, and rule templates on Cloudflare",
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
    session: {
      title: "Admin Token",
      desc: "Logging out clears the admin token stored in this browser and returns to the token entry screen.",
      logout: "Log out",
      confirmTitle: "Log out",
      confirmContent: "This clears the admin token stored in this browser. You will need to enter it again. Continue?"
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
      desc: "Controls how the Worker fetches remote subscriptions. Changes apply to the next download or preview.",
      defaultUserAgent: "Default User-Agent",
      defaultFlowUserAgent: "Usage-info User-Agent",
      defaultTimeout: "Request timeout (ms)",
      backendRequestConcurrency: "Remote subscription concurrency",
      backendRequestConcurrencyWaitTime: "Delay between concurrent requests (ms)",
      remoteCacheTtl: "Remote cache TTL (s, 0 = off)",
      remoteCacheStaleOnError: "Serve the last cached copy when a remote source fails",
      subrequestLimit: "Subrequest limit per request",
      nodeInfoApiUrl: "Node-info API (HTTPS, must contain {'{ip}'})",
      unlimited: "Blank = no limit",
      rangeHint: "{min}–{max}",
      rangeError: "Enter a whole number from {min} to {max}",
      nodeInfoApiUrlError: "Must be an HTTPS URL containing {'{ip}'}",
      required: "Required",
      invalid: "Some request settings are invalid. Check the highlighted fields."
    },
    btn: {
      reset: "Reset",
      cancel: "Cancel",
      edit: "Edit",
      save: "Save",
      delete: "Delete"
    },
    notify: {
      backup: {
        failedWithError: "Backup failed\n{e}"
      },
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
    subscriptionPreviewCopyLabel: "Click to copy the subscription link:",
    subscriptionPreviewLoadFailed: "Load failed: {e}",
    subscriptionPreviewCopied: "Copied link: {url}",
    remain: {
      title: "remain nodes",
      beforeIndicator: "before",
      afterIndicator: "after",
      indicatorDisabledTips: "No data available for {side}"
    },
    nodeNames: {
      entry: "All names",
      title: "{side} all node names",
      descriptionBefore: "Copy all node names, or copy a prompt that asks AI to summarize reusable naming rules. Apply the result with regex rename rules.",
      aiLink: "Keep region, multiplier, protocol, and entry number first, then normalize with regex rename rules.",
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
  }
};
