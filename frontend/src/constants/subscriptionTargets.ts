import jsonIcon from '@/assets/icons/json.svg';
import uriIcon from '@/assets/icons/uri.svg';
import v2rayIcon from '@/assets/icons/v2ray.png';
import singboxIcon from '@/assets/icons/sing-box.png';
import clashmetaIcon from '@/assets/icons/clashmeta.png';
import stashIcon from '@/assets/icons/stash.png';
import surgeIcon from '@/assets/icons/surge.png';
import loonIcon from '@/assets/icons/loon.png';
import quanxIcon from '@/assets/icons/quanx.png';
import shadowrocketIcon from '@/assets/icons/shadowrocket.png';
import surfboardIcon from '@/assets/icons/surfboard.png';
import egernIcon from '@/assets/icons/egern.png';

export type DownloadTarget =
  | 'mihomo'
  | 'stash'
  | 'surge'
  | 'surge-mac'
  | 'surfboard'
  | 'loon'
  | 'egern'
  | 'shadowrocket'
  | 'qx'
  | 'sing-box'
  | 'v2ray'
  | 'uri'
  | 'json';

export type TemplateTarget = 'mihomo' | 'stash';

export type SubscriptionTargetOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: string;
};

export const DOWNLOAD_TARGET_OPTIONS: SubscriptionTargetOption<DownloadTarget>[] = [
  { value: 'mihomo', label: 'Mihomo', icon: clashmetaIcon },
  { value: 'stash', label: 'Stash', icon: stashIcon },
  { value: 'surge', label: 'Surge', icon: surgeIcon },
  { value: 'surge-mac', label: 'Surge Mac', icon: surgeIcon },
  { value: 'loon', label: 'Loon', icon: loonIcon },
  { value: 'qx', label: 'Quantumult X', icon: quanxIcon },
  { value: 'shadowrocket', label: 'Shadowrocket', icon: shadowrocketIcon },
  { value: 'surfboard', label: 'Surfboard', icon: surfboardIcon },
  { value: 'egern', label: 'Egern', icon: egernIcon },
  { value: 'sing-box', label: 'sing-box', icon: singboxIcon },
  { value: 'v2ray', label: 'V2Ray', icon: v2rayIcon },
  { value: 'uri', label: 'URI', icon: uriIcon },
  { value: 'json', label: 'JSON', icon: jsonIcon },
];

export const TEMPLATE_TARGET_OPTIONS: SubscriptionTargetOption<TemplateTarget>[] = [
  { value: 'mihomo', label: 'Mihomo' },
  { value: 'stash', label: 'Stash' },
];

export const getTargetLabel = (value?: string) => {
  return [...DOWNLOAD_TARGET_OPTIONS, ...TEMPLATE_TARGET_OPTIONS]
    .find((option) => option.value === value)?.label || value || 'Mihomo';
};
