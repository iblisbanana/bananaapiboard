/**
 * Canvas 历史记录 API
 * 使用与普通模式相同的历史数据源
 * 数据来自 /api/images/history 和 /api/video/tasks
 */
import { getApiUrl, getTenantHeaders } from '@/config/tenant'

/**
 * 获取API基础URL
 */
function getApiBase() {
  const url = getApiUrl('')
  return url || ''
}

/**
 * 获取带认证的请求头
 */
function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...getTenantHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

/**
 * 获取历史记录列表（合并图片和视频历史）
 * @param {Object} params - 查询参数
 * @param {string} params.type - 类型筛选 (image/video/audio)
 */
export async function getHistory(params = {}) {
  const results = []
  
  // 获取图片历史
  if (!params.type || params.type === 'all' || params.type === 'image') {
    try {
      const imageResponse = await fetch(`${getApiBase()}/api/images/history?_=${Date.now()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      })
      
      if (imageResponse.ok) {
        const data = await imageResponse.json()
        const images = (data.images || []).map(img => ({
          id: img.id,
          type: 'image',
          name: img.prompt ? img.prompt.substring(0, 30) + (img.prompt.length > 30 ? '...' : '') : '图片',
          url: img.url,
          thumbnail_url: img.url,
          prompt: img.prompt,
          model: img.model,
          status: img.status,
          created_at: img.created ? new Date(img.created * 1000).toISOString() : null,
          size: img.size,
          aspect_ratio: img.aspect_ratio,
          reference_images: img.reference_images
        }))
        results.push(...images)
      }
    } catch (e) {
      console.error('[History API] 获取图片历史失败:', e)
    }
  }
  
  // 获取视频历史
  if (!params.type || params.type === 'all' || params.type === 'video') {
    try {
      const videoResponse = await fetch(`${getApiBase()}/api/videos/history?_=${Date.now()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      })
      
      if (videoResponse.ok) {
        const data = await videoResponse.json()
        const videos = (data.videos || []).map(vid => ({
          id: vid.id || vid.task_id,
          type: 'video',
          name: vid.prompt ? vid.prompt.substring(0, 30) + (vid.prompt.length > 30 ? '...' : '') : '视频',
          url: vid.video_url || vid.url,
          thumbnail_url: vid.cover_url || vid.thumbnail_url,
          prompt: vid.prompt,
          model: vid.model,
          status: vid.status === 'SUCCESS' ? 'completed' : vid.status,
          aspect_ratio: vid.aspect_ratio,
          created_at: vid.created_at
        }))
        results.push(...videos)
      }
    } catch (e) {
      console.error('[History API] 获取视频历史失败:', e)
    }
  }
  
  // 按创建时间倒序排序
  results.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeB - timeA
  })
  
  // 只返回已完成且有有效 URL 的记录
  const completedResults = results.filter(r => {
    // 必须是已完成状态
    if (r.status !== 'completed' && r.status !== 'SUCCESS') return false
    // 必须有有效的 URL
    if (!r.url || r.url === 'null' || r.url === 'undefined') return false
    // 过滤掉只有提示词没有实际内容的记录
    if (r.type === 'image' && !r.url.includes('/')) return false
    return true
  })
  
  return { history: completedResults }
}

/**
 * 获取单个历史记录详情
 * @param {string} historyId - 历史记录ID
 */
export async function getHistoryDetail(historyId) {
  // 对于现有数据源，直接返回基本信息
  return { history: { id: historyId } }
}

/**
 * 删除历史记录
 * @param {string} historyId - 历史记录ID
 * @param {string} type - 类型 (image/video)
 */
export async function deleteHistory(historyId, type = 'image') {
  const endpoint = type === 'video' 
    ? `${getApiBase()}/api/video/tasks/${historyId}`
    : `${getApiBase()}/api/images/history/${historyId}`
    
  const response = await fetch(endpoint, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || '删除历史记录失败')
  }
  
  return response.json()
}

