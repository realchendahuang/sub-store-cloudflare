export default {
  specificWord: {
    singleSub: "订阅源",
    collectionSub: "组合订阅",
    unknownType: "未知类型",
    unknownSource: "未知来源",
    unknown: "未知",
    all: "全部",
    untagged: "未分组",
    or: "或",
    type: "类型",
    none: "无",
    confirm: "确定"
  },
  globalNotify: {
    refresh: {
      succeed: "数据刷新完成",
      flowFailed: "刷新 {name} 失败！",
      failed: "数据刷新失败\n",
      loading: "刷新数据中...",
      backendChanged: "检测到后端变化，更新数据中..."
    },
    request: {
      failedWithStatus: "请求失败: {status} {statusText}",
      failedStatusOnly: "请求失败: {status}",
      failed: "请求失败",
      network: "网络错误或后端异常，无法连接后端服务\n",
      noResponse: "请求没有收到响应"
    }
  },
  navBar: {
    langSwitcher: {
      cellTitle: "轻点语言以切换",
      zh: "简体中文",
      en: "English",
      language: "语言"
    },
    actions: {
      back: "返回",
      refresh: "刷新数据",
      add: "新建"
    },
    listSearch: {
      open: "搜索",
      placeholder: "名称/标签/备注(若开启显示)",
      clear: "清空搜索",
      close: "关闭搜索"
    },
    pagesTitle: {
      sub: "订阅管理",
      tools: "兼容工具",
      my: "设置",
      subEditor: "编辑订阅",
      sourceCreate: "新建订阅源",
      sourceEdit: "编辑订阅源",
      collectionCreate: "新建组合订阅",
      collectionEdit: "编辑组合订阅",
      preview: "预览",
      notFound: "地址未找到"
    }
  },
  tabBar: {
    sub: "订阅",
    tools: "工具",
    my: "设置"
  },
  toolsPage: {
    converter: {
      title: "一次性转换",
      desc: "粘贴节点、订阅或规则，不保存到 D1，直接转换为目标格式。",
      proxy: "节点/订阅",
      rule: "规则",
      input: "粘贴待转换内容",
      output: "转换结果",
      run: "开始转换",
      copy: "复制结果"
    },
    shares: {
      title: "独立分享链接",
      desc: "为单个订阅源或组合创建可撤销、可过期、可限制格式的下载链接。Token 只在创建时显示。",
      resourceType: "资源类型",
      resourceId: "资源 ID",
      target: "限制输出格式，可留空",
      expires: "有效小时数，0 表示不过期",
      create: "创建链接",
      empty: "还没有独立分享链接",
      disable: "停用",
      enable: "启用"
    },
    recycle: {
      title: "回收站",
      desc: "最多保留 50 条已删除配置。恢复不会覆盖同名资源。",
      empty: "回收站为空",
      restore: "恢复",
      purge: "彻底删除"
    },
    notify: {
      converted: "转换完成",
      copied: "已复制",
      shareCreated: "分享链接已创建",
      failed: "操作失败\n{e}"
    }
  },
  notFoundPage: {
    title: "啊哦～ URL 错误！",
    desc: "回首页",
    backendDesc: "如果你看到这个 可能是因为浏览器前端路由拦截的问题 可以强制刷新查看或直接使用该链接 不影响此链接的使用"
  },
  subPage: {
    import: {
      label: "导入",
      succeed: "导入成功",
      failed: "导入失败\n{e}",
      tipsTitle: "导入订阅配置",
      tipsContent: "可导入订阅源或组合订阅的 JSON 配置。完整配置迁移请使用「设置」页面的备份恢复。"
    },
    addSubTitle: "选择要创建的订阅类型",
    previewTitle: "预览/拷贝订阅",
    tag: {
      addTagTitle: "添加标签",
      tagPlaceholder: "请输入标签名称",
      addTagBtn: "+ 新建标签"
    },
    emptySub: {
      title: "你还没有添加订阅",
      desc: "添加远程订阅或本地节点后开始聚合",
      btn: "立即添加"
    },
    loadFailed: {
      title: "数据加载失败",
      desc: "如果刚完成部署，请先输入管理 Token；否则请检查 Worker API 和网络连接。",
      btn: "重试",
      tokenLabel: "管理 Token",
      tokenPlaceholder: "输入 SUB_STORE_ADMIN_TOKEN",
      saveAndRetry: "保存并重试",
      doc: "查看部署文档",
      followOfficialChannel: "查看项目文档后再排查部署状态",
      about: "查看项目文档"
    },
    collectionItem: {
      noSub: "全部已启用订阅源",
      contain: "包含的订阅源"
    },
    actions: {
      openMenu: "展开快捷操作",
      closeMenu: "收起快捷操作",
      openApp: "打开订阅官网",
      preview: "即时预览",
      copyLink: "复制订阅链接",
      refresh: "刷新流量信息",
      edit: "编辑",
      moreActions: "打开更多操作",
      cloneConfig: "克隆",
      openDownload: "打开下载链接",
      delete: "删除",
      openTarget: "打开 {name} 订阅",
      copyTarget: "复制 {name} 订阅"
    },
    subItem: {
      local: "本地订阅",
      loading: "加载中...",
      flow: "已用/总流量",
      showRemainingFlow: "剩余/总流量",
      expires: "到期",
      remainingDays: "重置",
      remainingDaysUnit: " 天",
      noRecord: "刷新后可获取流量情况",
      noFlow: "不查询流量",
      noFlowInfo: "无流量信息",
      flowError: "无法获取流量信息",
      noExpiresInfo: "无有效期信息"
    },
    deleteItem: {
      title: "删除",
      desc: "是否确认删除 {displayName}？删除后不可恢复！",
      succeedNotify: "删除成功！",
      btn: {
        confirm: "确认删除",
        cancel: "取消"
      }
    },
    copyNotify: {
      succeed: "复制订阅链接成功\n请导入代理工具使用",
      failed: "复制订阅链接失败\n{e}"
    },
    copyConfigNotify: {
      loading: "克隆配置中...",
      succeed: "配置克隆成功！",
      failed: "配置克隆失败！\n{e}"
    },
    exportConfigNotify: {
      loading: "导出配置中...",
      succeed: "导出成功！",
      failed: "导出失败！\n{e}"
    },
    panel: {
      general: "通用订阅",
      tips: {
        ok: "查看文档",
        cancel: "取消",
        desc: "下载链接可选择输出格式，也支持临时 url/content/ua 参数",
        title: "订阅链接参数",
        content: "https://github.com/realchendahuang/sub-store-cloudflare#%E9%83%A8%E7%BD%B2"
      }
    },
    sort: {
      failed: "排序保存失败"
    }
  },
  editorPage: {
    groupingTips: {
      open: "详情页分组说明",
      title: "详情页分组",
      content: "详情页按显示、内容和操作分组，便于只维护订阅源、组合关系、节点处理和规则模板。",
      goSettings: "确定",
      cancel: "取消"
    },
    commonTips: {
      open: "详情页常用配置说明",
      title: "详情页常用配置",
      content: "常用配置会生成一组节点处理动作，用于过滤无效节点并批量设置 UDP、TFO、跳过证书验证等常见字段。",
      goSettings: "确定",
      cancel: "取消"
    },
    subConfig: {
      btn: {
        compare: "即时预览",
        save: "保存"
      },
      editorTabs: {
        display: "显示",
        content: "内容",
        actions: "操作"
      },
      pop: {
        helpTitle: "节点操作帮助",
        helpContent: "预览开关可控制即时预览时该模块是否生效，当保存时无论开启关闭都会保存并生效于订阅\n\n所有节点操作均为有序生效，可按住手柄拖动排序，点击即时进行预览对比",
        helpBtn: "我知道了",
        errorTitle: "提交出错！",
        errorBtn: "去修改",
        succeedMsg: "保存成功！",
        deleteTitle: "删除确认",
        deleteDes: "是否确认删除此操作？删除后不可恢复！\n\ntips: 可使用开关控制即时预览时是否生效",
        deleteConfirm: "确认删除",
        deleteCancel: "取消",
        clearTitle: "清空确认",
        clearDes: "是否确认清空？",
        clearConfirm: "确认清空",
        clearCancel: "取消",
        leaveCancel: "继续编辑",
        leaveConfirm: "确认离开",
        leaveConfirmTitle: "有内容未保存",
        leaveContent: "输入框存在未保存内容，离开后未保存的操作将丢失\n\n请确认是否离开？",
        clickTag: {
          title: "编辑确认",
          content: "输入框存在未保存的内容，现在编辑其他标签当前未保存的内容将丢失\n\n请确认？",
          confirm: "确认",
          cancel: "取消"
        }
      },
      basic: {
        label: "订阅配置",
        previewSwitch: "预览",
        previewDisabledResponseOnlyTips: "修改响应仅在下载响应发送前执行，即时预览不会执行",
        nodeActionsHelp: "节点操作帮助",
        name: {
          label: "ID",
          placeholder: "小写字母、数字、下划线或连字符",
          isEmpty: "ID 不能为空",
          isInvalid: "ID 已存在，或不符合 1–64 位格式要求"
        },
        remark: {
          label: "备注",
          placeholder: "请输入备注信息"
        },
        displayName: {
          label: "显示名称",
          placeholder: "输入展示的名称"
        },
        subInfoUrl: {
          label: "查询流量信息订阅链接",
          placeholder: "用于查询流量信息的 http(s) 链接",
          tips: {
            title: "查询流量信息订阅链接",
            content: "填写用于查询流量信息的 http(s) 链接。Worker 会读取响应体或响应头 subscription-userinfo/profile-web-page-url/plan-name。\n\n也可以在远程订阅链接的 # 参数中使用 flowUrl、flowUserAgent、flowHeaders 指定独立查询地址、User-Agent 和请求头。"
          }
        },
        subInfoUserAgent: {
          label: "查询流量信息 User-Agent",
          placeholder: "不设置则使用默认 User-Agent"
        },
        tag: {
          label: "标签",
          placeholder: "点击右侧图标选择，标签(用 , 分隔) 将用于分组"
        },
        template: {
          label: "规则模板",
          pickerTitle: "选择规则模板",
          builtIn: "内置模板",
          custom: "自定义模板",
          tips: "类型：{type}\n输出：{target}\n\n模板会在生成组合订阅时写入代理组、规则提供者和分流规则。"
        },
        source: {
          label: "来源",
          remote: "远程订阅",
          local: "本地订阅",
          mergeSources: "合并来源",
          noMerge: "不合并",
          localFirst: "本地优先",
          remoteFirst: "远程优先"
        },
        url: {
          label: "链接",
          placeholder: "每行一个 http(s) 远程订阅链接",
          tips: {
            importFromFile: "从文件导入",
            fullScreenEdit: "全屏编辑",
            fullScreenEditCancel: "取消全屏",
            label: "使用说明",
            title: "订阅链接",
            content: "每行填写一个完整的 http(s) 远程订阅链接。多个链接会按行拉取并合并。\n\n流量信息相关参数:\n\nflowUrl: 自定义查询流量信息的 URL，优先读取响应体，也支持 subscription-userinfo/profile-web-page-url/plan-name 响应头\nflowUserAgent: 查询流量信息时使用的 User-Agent\nflowHeaders: 查询流量信息时使用的请求头，值为 URL 编码后的单行 JSON\nnoFlow: 不查询流量信息\nhideExpire: 隐藏到期时间\nshowRemaining: 显示剩余流量而不是已用流量\n\n远程订阅拉取的 User-Agent 可在本页单独设置；请求超时和并发在「设置」页面配置。\n\n例: https://example.com/sub?token=1#flowUrl=https%3A%2F%2Fexample.com%2Fuserinfo&showRemaining"
          },
          isEmpty: "订阅链接不能为空",
          isIllegal: "订阅链接格式非法"
        },
        subscriptions: {
          label: "包含的订阅源",
          empty: "请先创建订阅源，再使用组合订阅功能",
          none: "未选择",
          allEnabled: "全部已启用订阅源"
        },
        content: {
          label: "内容",
          placeholder: "",
          validation: {
            action: "校验节点",
            checking: "校验中",
            empty: "请先填入本地节点内容",
            success: "已解析 {count} 个节点",
            detail: "协议分布: {types}",
            failed: "未解析到有效节点",
            noNodes: "未解析到有效节点",
            importFailed: "文件导入失败",
            compareLoading: "生成节点对比中...",
            submitLoading: "拉取订阅中...",
            submitBusy: "拉取订阅中，请勿重复点击..."
          },
          tips: {
            title: "本地订阅节点",
            content: "填入订阅内容:\n\n1. 换行输入多个单行代理协议、Mihomo YAML 或 JSON\n\n2. 完整 Base64/YAML\n\n3. 常见 Surge、Loon、Quantumult X 单行节点\n\n支持常见协议: ss、ssr、vmess、vless、trojan、hysteria、hysteria2、tuic、anytls、http、socks5、wireguard"
          }
        },
        icon: {
          label: "图标链接",
          placeholder: "可点击左侧或顶部图标, 从图标库填入图标链接，不要使用 jpg"
        },
        isIconColor: {
          label: "图标原色"
        },
        ignoreFailedRemoteSub: {
          label: "订阅失败处理",
          disabled: "严格报错",
          disabledNote: "任一订阅源失败即终止",
          skip: "跳过失败源",
          skipNote: "保留其他可用订阅源"
        },
        ua: {
          label: "User-Agent",
          placeholder: "下载时使用的 UA，不填使用默认",
          placeholderDisabled: "透传时禁用自定义 UA",
          tips: {
            title: "默认使用配置中的全局 UA",
            content: "可尝试设置为 clash-verge/v2.4.6、v2rayNG 等客户端的 User-Agent，让机场后端下发更多协议。可根据实际情况改成当前客户端版本号。"
          }
        },
        subUserinfo: {
          label: "订阅流量信息",
          placeholder: "upload=...; download=...; total=...",
          tips: {
            title: "手动设置订阅流量信息",
            content: "填写 subscription-userinfo 风格的流量信息。若需要从单独 URL 查询流量，请在远程订阅链接的 # 参数里设置 flowUrl。\n\n格式示例:\n\nupload=1024; download=10240; total=102400; expire=4115721600; reset_day=14; plan_name=VIP1; app_url=http%3A%2F%2Fa.com\n\n1. app_url 会显示为可点击跳转按钮，URL 请编码。\n\n2. plan_name 会作为套餐名称显示。\n\n3. reset_day 表示流量重置剩余天数。\n\n手动填写的值会和远程订阅响应头一起解析。"
          }
        },
        firstSubFlow: {
          label: "透传单条订阅流量信息",
          tips: {
            title: "透传单条订阅流量信息",
            content: "组合订阅默认透传第一个单条订阅的流量信息。若需要展示聚合后的流量，请在对应订阅源里手动填写 subscription-userinfo，或使用独立 flowUrl 查询。",
            okText: "确定"
          }
        },
        passThroughUA: {
          label: "透传请求的 User-Agent",
          warning: "透传请求的 User-Agent 和 自定义 UA 不可同时启用"
        },
        proxy: {
          label: "代理/策略",
          placeholder: "通过代理/节点/策略获取远程资源，不填使用默认"
        }
      },
      commonOptions: {
        label: "常用配置",
        useless: {
          label: "过滤非法节点",
          disabled: "保留",
          enabled: "删除"
        },
        udp: {
          label: "UDP 转发",
          default: "默认",
          enabled: "强制开启",
          disabled: "强制关闭"
        },
        scert: {
          label: "跳过证书验证",
          default: "默认",
          enabled: "强制开启",
          disabled: "强制关闭"
        },
        tfo: {
          label: "TCP Fast Open",
          default: "默认",
          enabled: "强制开启",
          disabled: "强制关闭"
        },
        "vmess aead": {
          label: "Vmess AEAD",
          default: "默认",
          enabled: "强制开启",
          disabled: "强制关闭"
        }
      },
      actions: {
        label: "节点操作",
        addAction: {
          title: "添加一个操作",
          cancel: "取消",
          confirm: "确认"
        },
        pasteAction: {
          label: "从剪贴板导入",
          placeholder: "自动读取剪贴板失败, 请在此文本框内手动粘贴数据",
          copied: "已复制数据，可用于导入",
          importFailed: "导入失败 {e}",
          sourceMismatch: "文件操作与订阅操作不通用",
          invalidData: "数据格式错误"
        },
        enable: "启用",
        disable: "禁用",
        script: {
          freeVerified: "已通过 Cloudflare 免费版验证",
          personal: "个人构建时脚本",
          unavailable: "当前部署中没有这个脚本。请重新部署包含该脚本的 Worker。",
          limit: "每个订阅源或组合订阅最多添加两个脚本操作"
        }
      },
      nodeActions: {
        "Flag Operator": {
          label: "旗帜操作",
          des: "工作模式",
          options: [
            "添加",
            "移除"
          ],
          twOptions: [
            "替换为 🇨🇳",
            "替换为 🇼🇸",
            "保持不变"
          ],
          tipsTitle: "旗帜操作提示",
          tipsDes: "为节点添加或者移除旗帜\n\n免责声明: 旗帜 指 Emoji 旗帜, 不包含任何政治意味",
          twWhenPrefix: "识别为",
          twWhenSuffix: "时",
          disclaimer: "免责声明: 本操作仅将 Emoji 旗帜进行替换以便于显示, 不包含任何政治意味"
        },
        "Sort Operator": {
          label: "节点排序",
          des: "顺序",
          options: [
            "正序",
            "逆序",
            "随机"
          ],
          tipsTitle: "排序操作提示",
          tipsDes: "按照节点名字进行排序"
        },
        "Resolve Domain Operator": {
          label: "域名解析",
          des: "提供商(可由节点字段 \"_no-resolve\" 控制)",
          options: [
            "Google",
            "Cloudflare",
            "Ali",
            "Tencent",
            "自定义"
          ],
          types: [
            "IPv4",
            "IPv6"
          ],
          filters: [
            "不过滤",
            "移除失败",
            "只保留 IP",
            "只保留 IPv4",
            "只保留 IPv6"
          ],
          cache: [
            "启用",
            "禁用"
          ],
          concurrency: "请求并发数",
          concurrencyPlaceholder: "默认 10. 在代理 App 中建议不超过 20",
          customDohPlaceholder: "目前仅支持 DoH",
          edns: "EDNS(Google, Ali, Tencent, 自定义 DoH 会携带此参数, 可能会影响解析结果)",
          ednsPlaceholder: "请输入纯 IP, 默认为 223.6.6.6",
          resolveType: "解析类型(IPv6 兼容 IP4P)",
          filterResult: "过滤结果",
          unsupported: "{provider} 不支持 {type}",
          ip4pTitle: "IP4P 地址格式",
          ip4pContent: "当选择解析类型为 IPv6 时\n将自动转换其中的 IP4P 地址\n\n来自 NATMap, 将 IPv4 地址和端口同时编码在 DNS AAAA 记录中\n\n使用场景: STUN 内网穿透, 无需公网服务器即可获得 IPv4 公网地址",
          ip4pOk: "更多说明",
          tipsTitle: "域名解析操作提示",
          tipsDes: "将节点域名解析成为 IP 地址，减少一次额外的 DNS 请求"
        },
        "Region Filter": {
          label: "区域过滤",
          des: [
            "区域",
            "工作模式"
          ],
          modeOptions: [
            "保留模式",
            "过滤模式"
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
          tipsTitle: "区域过滤操作提示",
          tipsDes: "按照国家和区域过滤节点"
        },
        "Type Filter": {
          label: "协议过滤",
          des: [
            "协议",
            "工作模式"
          ],
          modeOptions: [
            "保留模式",
            "过滤模式"
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
          tipsTitle: "节点类型过滤操作提示",
          tipsDes: "按照代理协议类型过滤节点"
        },
        "Regex Filter": {
          label: "正则过滤",
          des: [
            "正则表达式",
            "工作模式"
          ],
          options: [
            "保留模式",
            "过滤模式"
          ],
          placeholder: [
            "填入正则表达式"
          ],
          tipsTitle: "正则过滤操作提示",
          tipsDes: "按照正则表达式过滤节点。保留模式下，节点名匹配到任何一个正则表达式的都会被保留；过滤模式下，节点名匹配到任何一个正则表达式的都会被移除"
        },
        "Regex Sort Operator": {
          label: "正则排序",
          des: [
            "正则表达式",
            "未匹配节点排序方式"
          ],
          options: [
            "正序",
            "逆序",
            "不变"
          ],
          placeholder: [
            "填入正则表达式"
          ],
          tipsTitle: "正则排序操作提示",
          tipsDes: "按照正则表达式进行排序。节点名匹配到第一个正则表达式的会排在最前面，匹配到第二个正则表达式的会排在第二个位置，以此类推"
        },
        "Regex Delete Operator": {
          label: "正则删除",
          des: [
            "正则表达式"
          ],
          placeholder: [
            "填入正则表达式"
          ],
          tipsTitle: "正则删除操作提示",
          tipsDes: "按照正则表达式删除节点名中的字段"
        },
        "Regex Rename Operator": {
          label: "正则命名",
          des: [
            "正则表达式"
          ],
          placeholder: [
            "填入正则表达式",
            "替换为"
          ],
          tipsTitle: "正则重命名操作提示",
          tipsDes: "按照正则表达式对节点进行重命名。"
        },
        "Handle Duplicate Operator": {
          label: "节点去重",
          action: {
            options: [
              "重命名",
              "删除"
            ],
            des: "操作"
          },
          position: {
            options: [
              "前缀",
              "后缀"
            ],
            des: "序号位置"
          },
          template: {
            des: "序号格式",
            placeholder: "序号显示格式，用空格分隔，如：1 2 3 4 5 6 7 8 9"
          },
          link: {
            des: "连接符",
            placeholder: "节点名和序号之间的连接符，如：- "
          },
          field: {
            des: "去重字段(多字段连接 支持 lodash get 语法)",
            placeholder: "例如节点名, 请输入 name"
          },
          tipsTitle: "节点去重操作提示",
          tipsDes: "对名字重复的节点进行操作（移除/重命名）。重命名模式下，会自动为重名节点添加序号，序号样式和位置可以自定义。同时序号和名字之间的连接符也可以自定义"
        },
        "Script Filter": {
          label: "构建时脚本过滤",
          tipsTitle: "脚本过滤说明",
          tipsDes: "运行已经随 Worker 编译的过滤脚本。脚本不是从网页、D1 或远程地址动态执行。"
        },
        "Script Operator": {
          label: "构建时脚本操作",
          tipsTitle: "脚本操作说明",
          tipsDes: "运行已经随 Worker 编译的节点修改脚本。内置脚本经过免费版验证；个人脚本需要重新部署。"
        }
      },
      sourceNamePicker: {
        title: "选择订阅名称",
        cancel: "取消",
        confirm: "确定",
        emptyTips: "未找到订阅？点击去添加订阅"
      }
    }
  },
  myPage: {
    profile: {
      desc: "订阅聚合、节点处理和云端规则模板",
      runtime: "运行环境",
      storage: "存储",
      version: "版本"
    },
    backup: {
      title: "备份与恢复",
      desc: "导出和恢复订阅源、组合订阅、规则模板与请求设置。",
      export: "备份",
      restore: "恢复",
      restoreTitle: "恢复备份",
      restoreContent: "恢复会覆盖同名订阅源、组合订阅、规则模板和设置。建议先导出当前备份。"
    },
    templates: {
      title: "规则模板",
      importFile: "文件导入",
      create: "新建",
      builtIn: "内置模板",
      custom: "自定义模板",
      editTitle: "编辑规则模板",
      importTitle: "导入规则模板",
      idPlaceholder: "模板 ID，例如 custom-mihomo",
      namePlaceholder: "显示名称，例如 Custom Mihomo",
      target: "输出格式",
      targetPickerTitle: "选择输出格式",
      save: "保存模板",
      validationRequired: "模板 ID 和内容不能为空",
      saveSucceed: "模板已保存",
      saveFailed: "模板保存失败\n{e}",
      deleteTitle: "删除模板",
      deleteContent: "确认删除模板 {name}？",
      deleteSucceed: "模板已删除"
    },
    request: {
      title: "请求设置",
      defaultUserAgent: "默认 User-Agent",
      defaultFlowUserAgent: "流量信息 User-Agent",
      defaultTimeout: "请求超时，单位毫秒",
      backendRequestConcurrency: "远程订阅并发数",
      backendRequestConcurrencyWaitTime: "并发请求间隔，单位毫秒",
      remoteCacheTtl: "远程订阅边缘缓存秒数，0 表示关闭",
      remoteCacheStaleOnError: "远程订阅失败时允许使用最近的边缘缓存",
      nodeInfoApiUrl: "节点信息 HTTPS API，必须包含 {ip}",
      summary: "当前远程订阅拉取并发 {concurrency}，超时 {timeout}ms。"
    },
    btn: {
      cancel: "取消",
      edit: "编辑",
      save: "保存",
      delete: "删除"
    },
    notify: {
      backup: {
        failedWithError: "备份失败\n{e}"
      },
      save: {
        succeed: "保存成功",
        failed: "保存失败",
        configLoadFailed: "获取配置失败",
        configUpdateFailed: "更新配置失败",
        themeLoading: "切换主题中...",
        themeFailed: "切换主题失败"
      },
      restore: {
        succeed: "恢复成功",
        failed: "恢复失败",
        failedWithError: "恢复失败\n{e}"
      }
    }
  },
  comparePage: {
    title: "即时预览",
    loading: "生成节点对比中...",
    subscriptionPreviewCopyLabel: "点击复制订阅链接:",
    subscriptionPreviewLoadFailed: "加载失败: {e}",
    subscriptionPreviewCopied: "已复制链接: {url}",
    remain: {
      title: "保留的节点",
      beforeIndicator: "操作前",
      afterIndicator: "操作后",
      indicatorDisabledTips: "{side}无可显示数据"
    },
    nodeNames: {
      entry: "全部节点名",
      title: "{side}全部节点名",
      descriptionBefore: "可复制全部节点名，也可复制提示词让 AI 帮你整理通用命名规则，再按结果配置正则重命名。",
      aiLink: "建议先保留地区、倍率、协议和入口编号，再用正则重命名统一格式。",
      copyAll: "复制全部节点名",
      copyPrompt: "复制提示词",
      copyAllSucceed: "节点名已复制",
      copyPromptSucceed: "提示词已复制",
      copyFailed: "复制失败\n{e}"
    },
    divider: "以下为被过滤的节点",
    filter: {
      title: "被过滤的节点"
    },
    tableHead: {
      name: "节点名&服务器",
      udp: "UDP",
      "skip-cert-verify": "SCERT",
      tfo: "TFO",
      aead: "AEAD"
    },
    nodeInfo: {
      loading: "获取节点信息中...",
      loadFailed: "获取节点信息失败",
      ipApi: {
        title: "IP API",
        loading: "正在获取 IP API 信息...",
        loadFailed: "IP API 获取失败",
        retry: "重试"
      },
      node: {
        title: "节点信息",
        server: "服务器",
        password: "密码",
        UUID: "UUID"
      }
    }
  },
  codeEditor: {
    copiedLength: "已复制字符串数: {count}",
    cleared: "已清空",
    pastedLength: "已粘贴字数: {count}",
    clipboardFailed: "获取剪贴板失败: 本地/HTTPS 环境下可用(或手动配置权限)"
  }
};
