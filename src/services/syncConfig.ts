/**
 * Sync Config
 * 同步配置管理：自动同步开关 + OSS 配置
 *
 * 自动同步开关：存储在 localStorage，新设备首次访问默认关闭。
 * OSS 配置：localStorage 优先，降级到 .env 环境变量。
 * 手动同步不受自动同步开关影响，始终可用。
 */

import { isOSSConfigured } from './oss';

// ─── 自动同步开关 ──────────────────────────────────────

const AUTO_SYNC_KEY = 'autoSyncEnabled';

/**
 * 读取自动同步开关状态
 * localStorage 中不存在时返回 false（新设备默认关闭）
 */
export function isAutoSyncEnabled(): boolean {
    return localStorage.getItem(AUTO_SYNC_KEY) === 'true';
}

/**
 * 设置自动同步开关状态
 */
export function setAutoSyncEnabled(enabled: boolean): void {
    localStorage.setItem(AUTO_SYNC_KEY, String(enabled));
    console.log(`[SyncConfig] 自动同步已${enabled ? '开启' : '关闭'}`);
}

/**
 * 检查自动同步是否就绪（OSS 已配置 且 开关已开启）
 * 用于 autoPush 和启动时自动 Pull 的前置检查
 */
export function isSyncReady(): boolean {
    return isOSSConfigured() && isAutoSyncEnabled();
}

// ─── OSS 配置管理 ──────────────────────────────────────

const OSS_CONFIG_KEY = 'ossConfig';

export interface OSSConfig {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
}

/**
 * 从 localStorage 读取用户保存的 OSS 配置
 * 如果没有保存过，返回 null
 */
export function getSavedOSSConfig(): OSSConfig | null {
    const saved = localStorage.getItem(OSS_CONFIG_KEY);
    if (!saved) return null;
    try {
        const config = JSON.parse(saved) as OSSConfig;
        // 验证关键字段存在
        if (config.accessKeyId && config.accessKeySecret && config.bucket) {
            return config;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * 保存 OSS 配置到 localStorage
 */
export function saveOSSConfig(config: OSSConfig): void {
    localStorage.setItem(OSS_CONFIG_KEY, JSON.stringify(config));
    console.log('[SyncConfig] OSS 配置已保存');
}

/**
 * 清除 localStorage 中的 OSS 配置（回退到 .env）
 */
export function clearOSSConfig(): void {
    localStorage.removeItem(OSS_CONFIG_KEY);
    console.log('[SyncConfig] OSS 配置已清除，将使用 .env 环境变量');
}
