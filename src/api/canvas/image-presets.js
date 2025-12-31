/**
 * Canvas Image Presets API Client
 * 图像预设 API 客户端
 */

import { getApiUrl, getTenantHeaders } from '@/config/tenant'

/**
 * 获取图像预设列表（租户全局预设 + 用户自定义预设）
 * @returns {Promise<{tenant: Array, user: Array}>}
 */
export async function getImagePresets() {
  const token = localStorage.getItem('token')

  const response = await fetch(getApiUrl('/api/canvas/image-presets'), {
    method: 'GET',
    headers: {
      ...getTenantHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '获取预设失败')
  }

  const data = await response.json()
  return data.presets // { tenant: [], user: [] }
}

/**
 * 获取单个图像预设详情
 * @param {String} presetId - 预设ID
 * @returns {Promise<Object>}
 */
export async function getImagePresetById(presetId) {
  const token = localStorage.getItem('token')

  const response = await fetch(getApiUrl(`/api/canvas/image-presets/${presetId}`), {
    method: 'GET',
    headers: {
      ...getTenantHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '获取预设失败')
  }

  const data = await response.json()
  return data.preset
}

/**
 * 创建用户自定义图像预设
 * @param {Object} presetData - 预设数据
 * @param {String} presetData.name - 预设名称（必填）
 * @param {String} presetData.prompt - 提示词内容（必填）
 * @param {String} presetData.description - 预设描述（可选）
 * @param {String} presetData.category - 分类（可选，默认 general）
 * @param {Array<String>} presetData.tags - 标签数组（可选）
 * @param {String} presetData.coverImage - 封面图URL（可选）
 * @param {Array<String>} presetData.exampleImages - 示例图片URL数组（可选，最多9张）
 * @returns {Promise<Object>} 创建的预设
 */
export async function createImagePreset(presetData) {
  const token = localStorage.getItem('token')

  const response = await fetch(getApiUrl('/api/canvas/image-presets'), {
    method: 'POST',
    headers: {
      ...getTenantHeaders(),
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(presetData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '创建预设失败')
  }

  const data = await response.json()
  return data.preset
}

/**
 * 更新用户自定义图像预设
 * @param {String} presetId - 预设ID
 * @param {Object} presetData - 更新的数据
 * @returns {Promise<Object>} 更新后的预设
 */
export async function updateImagePreset(presetId, presetData) {
  const token = localStorage.getItem('token')

  const response = await fetch(getApiUrl(`/api/canvas/image-presets/${presetId}`), {
    method: 'PUT',
    headers: {
      ...getTenantHeaders(),
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(presetData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '更新预设失败')
  }

  const data = await response.json()
  return data.preset
}

/**
 * 删除用户自定义图像预设
 * @param {String} presetId - 预设ID
 * @returns {Promise<void>}
 */
export async function deleteImagePreset(presetId) {
  const token = localStorage.getItem('token')

  const response = await fetch(getApiUrl(`/api/canvas/image-presets/${presetId}`), {
    method: 'DELETE',
    headers: {
      ...getTenantHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '删除预设失败')
  }
}

/**
 * 增加预设使用次数（用于统计）
 * @param {String} presetId - 预设ID
 * @returns {Promise<void>}
 */
export async function incrementPresetUseCount(presetId) {
  const token = localStorage.getItem('token')

  try {
    await fetch(getApiUrl(`/api/canvas/image-presets/${presetId}/use`), {
      method: 'POST',
      headers: {
        ...getTenantHeaders(),
        'Authorization': `Bearer ${token}`
      }
    })
    // 不需要处理响应，静默失败
  } catch (error) {
    console.warn('[ImagePresets] 增加使用次数失败:', error)
  }
}
