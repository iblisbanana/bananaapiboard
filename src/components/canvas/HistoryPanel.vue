<script setup>
/**
 * HistoryPanel.vue - 历史记录面板
 * 使用虚拟滚动实现无限瀑布流，只渲染可视区域的内容
 * 历史记录在服务器缓存7天，过期自动清理
 * 支持放大预览（滚轮缩放、拖拽平移）、下载、删除
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { getHistory, getHistoryDetail, deleteHistory } from '@/api/canvas/history'
import { useI18n } from '@/i18n'

const { t, currentLanguage } = useI18n()

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close', 'apply-history'])

// ========== 状态 ==========
const loading = ref(false)
const historyList = ref([])
const selectedType = ref('all') // all | image | video | audio
const searchQuery = ref('')

// 滚动容器引用
const scrollContainerRef = ref(null)

// 全屏预览状态
const showPreview = ref(false)
const previewItem = ref(null)
const previewVideoRef = ref(null)

// 预览图片缩放和平移状态
const previewScale = ref(1)
const previewTranslate = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const lastTranslate = ref({ x: 0, y: 0 })

// 视频缩略图缓存
const videoThumbnails = ref({})

// 图片加载失败的记录
const imageLoadErrors = ref({})

// 删除确认弹窗状态
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)

// 文件类型
const fileTypes = [
  { key: 'all', labelKey: 'common.all', icon: '◈' },
  { key: 'image', labelKey: 'canvas.nodes.image', icon: '◫' },
  { key: 'video', labelKey: 'canvas.nodes.video', icon: '▷' },
  { key: 'audio', labelKey: 'canvas.nodes.audio', icon: '♪' }
]

// 筛选后的历史记录（全部）
const filteredHistory = computed(() => {
  let result = historyList.value

  // 按类型筛选
  if (selectedType.value !== 'all') {
    result = result.filter(h => h.type === selectedType.value)
  }

  // 搜索
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(h => 
      h.name?.toLowerCase().includes(query) ||
      h.prompt?.toLowerCase().includes(query) ||
      h.model?.toLowerCase().includes(query)
    )
  }

  return result
})

// 按类型分组的统计
const historyStats = computed(() => {
  const stats = { all: 0, image: 0, video: 0, audio: 0 }
  historyList.value.forEach(h => {
    stats.all++
    if (stats[h.type] !== undefined) {
      stats[h.type]++
    }
  })
  return stats
})

// ========== 方法 ==========

// 加载历史记录（一次性加载全部，7天内）
async function loadHistory() {
  loading.value = true
  try {
    const result = await getHistory()
    historyList.value = result.history || []
    console.log('[HistoryPanel] 加载历史记录:', historyList.value.length, '条')
  } catch (error) {
    console.error('[HistoryPanel] 加载历史记录失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取预览内容
function getPreviewContent(item) {
  switch (item.type) {
    case 'image':
      return item.thumbnail_url || item.url
    case 'video':
      return item.thumbnail_url || item.url
    case 'audio':
      return null
    default:
      return null
  }
}

// 格式化时间
function formatDate(date) {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  
  if (diff < 60000) return t('time.justNow')
  if (diff < 3600000) return t('time.minutesAgo', { '0': Math.floor(diff / 60000) })
  if (diff < 86400000) return t('time.hoursAgo', { '0': Math.floor(diff / 3600000) })
  if (diff < 604800000) return t('time.daysAgo', { '0': Math.floor(diff / 86400000) })
  
  return d.toLocaleDateString()
}

// 格式化尺寸/分辨率
function formatSize(item) {
  if (item.size) return item.size
  if (item.aspect_ratio) return item.aspect_ratio
  return ''
}

// 删除历史记录 - 打开确认弹窗
function handleDelete(e, item) {
  if (e) e.stopPropagation()
  deleteTarget.value = item
  showDeleteConfirm.value = true
}

// 取消删除
function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

// 确认删除
async function confirmDelete() {
  if (!deleteTarget.value) return
  
  const item = deleteTarget.value
  showDeleteConfirm.value = false
  
  try {
    await deleteHistory(item.id, item.type)
    historyList.value = historyList.value.filter(h => h.id !== item.id)
    
    // 如果在预览模式下删除了当前预览的项，关闭预览
    if (previewItem.value && previewItem.value.id === item.id) {
      closePreview()
    }
    
    deleteTarget.value = null
  } catch (error) {
    console.error('[HistoryPanel] 删除历史记录失败:', error)
    deleteTarget.value = null
  }
}

// 下载文件
function handleDownload(item) {
  if (!item.url) return
  
  const a = document.createElement('a')
  a.href = item.url
  a.download = item.name || `${item.type}_${item.id}`
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// 点击历史记录 - 打开全屏预览
function handleHistoryClick(item) {
  previewItem.value = item
  showPreview.value = true
  // 重置缩放和平移状态
  previewScale.value = 1
  previewTranslate.value = { x: 0, y: 0 }
}

// 关闭全屏预览
function closePreview() {
  showPreview.value = false
  previewItem.value = null
  previewScale.value = 1
  previewTranslate.value = { x: 0, y: 0 }
}

// ========== 预览图片缩放和平移 ==========

// 鼠标滚轮缩放
function handlePreviewWheel(e) {
  e.preventDefault()
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.max(0.1, Math.min(10, previewScale.value + delta))
  
  // 以鼠标位置为中心缩放
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  
  const scaleRatio = newScale / previewScale.value
  previewTranslate.value = {
    x: x - (x - previewTranslate.value.x) * scaleRatio,
    y: y - (y - previewTranslate.value.y) * scaleRatio
  }
  
  previewScale.value = newScale
}

// 开始拖拽
function handlePreviewMouseDown(e) {
  if (e.button !== 0) return // 只响应左键
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  lastTranslate.value = { ...previewTranslate.value }
  e.preventDefault()
}

// 拖拽移动
function handlePreviewMouseMove(e) {
  if (!isDragging.value) return
  
  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y
  
  previewTranslate.value = {
    x: lastTranslate.value.x + dx,
    y: lastTranslate.value.y + dy
  }
}

// 结束拖拽
function handlePreviewMouseUp() {
  isDragging.value = false
}

// 双击重置
function handlePreviewDoubleClick() {
  previewScale.value = 1
  previewTranslate.value = { x: 0, y: 0 }
}

// 缩放按钮
function zoomIn() {
  previewScale.value = Math.min(10, previewScale.value + 0.25)
}

function zoomOut() {
  previewScale.value = Math.max(0.1, previewScale.value - 0.25)
}

function resetZoom() {
  previewScale.value = 1
  previewTranslate.value = { x: 0, y: 0 }
}

// 应用到画布（包含工作流快照）
async function applyToCanvas() {
  if (!previewItem.value) return
  
  try {
    // 获取完整的历史记录详情（包含工作流快照）
    const detail = await getHistoryDetail(previewItem.value.id)
    
    emit('apply-history', {
      ...previewItem.value,
      workflow_snapshot: detail.history?.workflow_snapshot || null
    })
    
    closePreview()
    emit('close')
  } catch (error) {
    console.error('[HistoryPanel] 获取历史记录详情失败:', error)
    // 即使获取详情失败，也尝试应用基本信息
    emit('apply-history', previewItem.value)
    closePreview()
    emit('close')
  }
}

// 提取视频首帧作为缩略图
function extractVideoThumbnail(item) {
  if (item.type !== 'video' || !item.url) return
  if (videoThumbnails.value[item.id]) return
  
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'metadata'
  
  video.onloadeddata = () => {
    video.currentTime = 0.1
  }
  
  video.onseeked = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 180
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      videoThumbnails.value[item.id] = canvas.toDataURL('image/jpeg', 0.7)
    } catch (e) {
      console.warn('[HistoryPanel] 无法提取视频缩略图:', e)
    }
    video.remove()
  }
  
  video.onerror = () => {
    console.warn('[HistoryPanel] 视频加载失败:', item.url)
    video.remove()
  }
  
  video.src = item.url
}

// 获取视频缩略图
function getVideoThumbnail(item) {
  if (item.thumbnail_url) return item.thumbnail_url
  if (videoThumbnails.value[item.id]) return videoThumbnails.value[item.id]
  
  nextTick(() => extractVideoThumbnail(item))
  return null
}

// 处理图片加载错误
function handleImageError(item) {
  imageLoadErrors.value[item.id] = true
}

// 检查图片是否加载失败
function hasImageError(item) {
  return imageLoadErrors.value[item.id] === true
}

// 开始拖拽到画布
function handleDragStart(e, item) {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'history-insert',
    history: {
      id: item.id,
      type: item.type,
      name: item.name,
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      prompt: item.prompt,
      model: item.model
    }
  }))
  e.dataTransfer.effectAllowed = 'copy'
  
  setTimeout(() => {
    emit('close')
  }, 100)
}

// ========== 生命周期 ==========

watch(() => props.visible, (visible) => {
  if (visible) {
    loadHistory()
  }
})

// 键盘事件
function handleKeydown(e) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    if (showPreview.value) {
      closePreview()
    } else {
      emit('close')
    }
  }
}

// 全局鼠标事件（用于拖拽）
function handleGlobalMouseMove(e) {
  handlePreviewMouseMove(e)
}

function handleGlobalMouseUp() {
  handlePreviewMouseUp()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
})
</script>

<template>
  <Transition name="panel">
    <div 
      v-if="visible" 
      class="history-panel-overlay"
      @click.self="$emit('close')"
    >
      <div class="history-panel">
        <!-- 头部 -->
        <div class="panel-header">
          <div class="header-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{{ t('canvas.historyPanel.title') }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- 文件类型筛选 -->
        <div class="type-filter">
          <button 
            v-for="ft in fileTypes" 
            :key="ft.key"
            class="type-btn"
            :class="{ active: selectedType === ft.key }"
            @click="selectedType = ft.key"
          >
            <span class="type-icon">{{ ft.icon }}</span>
            <span class="type-label">{{ t(ft.labelKey) }}</span>
            <span class="type-count">{{ historyStats[ft.key] || 0 }}</span>
          </button>
        </div>

        <!-- 搜索栏 -->
        <div class="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            v-model="searchQuery"
            type="text" 
            :placeholder="t('canvas.historyPanel.searchPlaceholder')"
            class="search-input"
          />
          <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</span>
        </div>

        <!-- 历史记录列表 - 虚拟滚动 -->
        <div class="history-list" ref="scrollContainerRef">
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <span>{{ t('common.loading') }}</span>
          </div>

          <div v-else-if="filteredHistory.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <p v-if="historyList.length === 0">{{ t('canvas.historyPanel.noHistory') }}</p>
            <p v-else>{{ t('canvas.historyPanel.noMatch') }}</p>
            <p class="empty-hint">{{ t('canvas.historyPanel.autoSaveHint') }}</p>
          </div>

          <!-- 瀑布流列表 -->
          <div v-else class="waterfall-container" ref="scrollContainerRef">
            <div class="waterfall-grid">
              <div 
                v-for="item in filteredHistory"
                :key="item.id"
                class="history-card"
                :class="[`type-${item.type}`]"
                draggable="true"
                @click="handleHistoryClick(item)"
                @dragstart="handleDragStart($event, item)"
              >
                <!-- 图片预览 -->
                <template v-if="item.type === 'image'">
                  <img 
                    v-if="getPreviewContent(item) && !hasImageError(item)" 
                    :src="getPreviewContent(item)" 
                    :alt="item.name"
                    class="card-image"
                    loading="lazy"
                    @error="handleImageError(item)"
                  />
                  <div v-else class="card-placeholder image">
                    <span class="placeholder-icon">◫</span>
                    <span class="placeholder-text" v-if="item.prompt">{{ item.prompt.length > 20 ? item.prompt.slice(0, 20) + '...' : item.prompt }}</span>
                  </div>
                </template>
                
                <!-- 视频预览 -->
                <template v-else-if="item.type === 'video'">
                  <img 
                    v-if="getVideoThumbnail(item)" 
                    :src="getVideoThumbnail(item)" 
                    :alt="item.name"
                    class="card-image"
                    loading="lazy"
                  />
                  <div v-else class="card-placeholder video">
                    <span class="placeholder-icon">▶</span>
                  </div>
                </template>
                
                <!-- 音频占位符 -->
                <div v-else-if="item.type === 'audio'" class="card-placeholder audio">
                  <span class="placeholder-icon">♪</span>
                </div>
                
                <!-- 其他类型占位符 -->
                <div v-else class="card-placeholder">
                  <span class="placeholder-icon">◈</span>
                  <span class="placeholder-text" v-if="item.prompt">{{ item.prompt.length > 20 ? item.prompt.slice(0, 20) + '...' : item.prompt }}</span>
                </div>

                <!-- 视频标识 -->
                <div v-if="item.type === 'video'" class="video-badge">▶</div>

                <!-- 悬停信息遮罩 -->
                <div class="hover-overlay">
                  <div class="overlay-content">
                    <div class="overlay-model" v-if="item.model">{{ item.model }}</div>
                    <div class="overlay-prompt" v-if="item.prompt">{{ item.prompt.length > 60 ? item.prompt.slice(0, 60) + '...' : item.prompt }}</div>
                    <div class="overlay-time">{{ formatDate(item.created_at) }}</div>
                  </div>
                  <button 
                    class="overlay-delete"
                    @click.stop="handleDelete($event, item)"
                    :title="t('common.delete')"
                  >×</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部统计 -->
        <div class="panel-footer">
          <span class="stats">{{ historyStats.all }} {{ t('canvas.historyPanel.items') }}</span>
          <span class="tip">{{ t('canvas.historyPanel.footerTip') }}</span>
        </div>
      </div>
    </div>
  </Transition>
  
  <!-- 全屏预览模态框 - 支持缩放和平移 -->
  <Teleport to="body">
    <Transition name="preview">
      <div 
        v-if="showPreview && previewItem" 
        class="history-preview-overlay" 
        @click.self="closePreview"
      >
        <div class="history-preview-modal">
          <!-- 顶部关闭按钮 -->
          <button class="close-preview-btn" @click="closePreview" title="关闭 (ESC)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          
          <!-- 预览内容 - 支持缩放和拖拽 -->
          <div 
            class="preview-content"
            @wheel.prevent="handlePreviewWheel"
            @mousedown="handlePreviewMouseDown"
            @dblclick="handlePreviewDoubleClick"
            :class="{ dragging: isDragging }"
          >
            <!-- 图片预览 -->
            <img 
              v-if="previewItem.type === 'image'" 
              :src="previewItem.url" 
              :alt="previewItem.name"
              class="preview-image"
              :style="{
                transform: `translate(${previewTranslate.x}px, ${previewTranslate.y}px) scale(${previewScale})`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }"
              draggable="false"
            />
            
            <!-- 视频预览 -->
            <video 
              v-else-if="previewItem.type === 'video'"
              ref="previewVideoRef"
              :src="previewItem.url"
              controls
              autoplay
              class="preview-video"
            ></video>
            
            <!-- 音频预览 -->
            <div v-else-if="previewItem.type === 'audio'" class="preview-audio">
              <div class="audio-icon">♪</div>
              <audio 
                :src="previewItem.url"
                controls
                autoplay
                class="audio-player"
              ></audio>
            </div>
          </div>
          
          <!-- 底部信息和操作栏 -->
          <div class="preview-footer">
            <!-- 信息区 -->
            <div class="preview-info-row">
              <span v-if="previewItem.model" class="info-tag">{{ previewItem.model }}</span>
              <span v-if="formatSize(previewItem)" class="info-tag">{{ formatSize(previewItem) }}</span>
              <span class="info-tag">{{ formatDate(previewItem.created_at) }}</span>
            </div>
            
            <!-- 提示词 -->
            <div v-if="previewItem.prompt" class="preview-prompt">{{ previewItem.prompt }}</div>
            
            <!-- 操作按钮组 -->
            <div class="preview-actions">
              <button class="action-btn apply-btn" @click="applyToCanvas">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                {{ t('canvas.historyPanel.applyToCanvas') }}
              </button>
              <button class="action-btn download-btn" @click="handleDownload(previewItem)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {{ t('common.download') }}
              </button>
              <button class="action-btn delete-btn" @click="handleDelete(null, previewItem)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- 删除确认弹窗 -->
    <Transition name="modal-fade">
      <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click="cancelDelete">
        <div class="delete-confirm-modal" @click.stop>
          <div class="delete-modal-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>
          <div class="delete-modal-title">{{ t('canvas.historyPanel.deleteConfirm') }}</div>
          <div class="delete-modal-desc">此操作无法撤销</div>
          <div class="delete-modal-preview" v-if="deleteTarget">
            <img 
              v-if="deleteTarget.type === 'image' && getPreviewContent(deleteTarget)" 
              :src="getPreviewContent(deleteTarget)" 
              :alt="deleteTarget.name"
            />
            <div v-else class="preview-placeholder">
              <span>{{ deleteTarget.type === 'video' ? '▶' : deleteTarget.type === 'audio' ? '♪' : '◫' }}</span>
            </div>
          </div>
          <div class="delete-modal-actions">
            <button class="modal-btn cancel-btn" @click="cancelDelete">
              取消
            </button>
            <button class="modal-btn confirm-btn" @click="confirmDelete">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.history-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 40px 0 40px 90px;
}

/* 面板 */
.history-panel {
  width: 480px;
  max-height: calc(100vh - 80px);
  background: linear-gradient(180deg, rgba(28, 28, 32, 0.98) 0%, rgba(20, 20, 24, 0.98) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 
    0 24px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* 头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.header-title svg {
  opacity: 0.6;
  color: rgba(255, 255, 255, 0.7);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.15s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 文件类型筛选 */
.type-filter {
  display: flex;
  gap: 4px;
  padding: 12px 12px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

/* 隐藏滚动条但保留滚动功能 */
.type-filter::-webkit-scrollbar {
  display: none;
}

.type-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.type-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.type-btn.active {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.type-icon {
  font-size: 13px;
}

.type-count {
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

.type-btn.active .type-count {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 20px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: all 0.2s;
}

.search-bar:focus-within {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.search-bar svg {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 13px;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.search-clear {
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
}

.search-clear:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* 历史记录列表 */
.history-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  min-height: 0;
}

.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.waterfall-container {
  padding: 8px;
}

.waterfall-grid {
  columns: 2;
  column-gap: 4px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.4);
  gap: 12px;
  height: 100%;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  height: 100%;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.4;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon svg {
  stroke: currentColor;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.3) !important;
}

/* 历史记录卡片 */
.history-card {
  position: relative;
  background: #1a1a1c;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  break-inside: avoid;
  margin-bottom: 4px;
}

.history-card:hover {
  transform: scale(1.02);
  z-index: 10;
}

.history-card:hover .hover-overlay {
  opacity: 1;
}

/* 卡片图片 */
.card-image {
  width: 100%;
  display: block;
  object-fit: cover;
}

/* 占位符 */
.card-placeholder {
  aspect-ratio: 1;
  background: linear-gradient(135deg, #2a2a2e 0%, #1a1a1c 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  min-height: 120px;
}

.card-placeholder.image {
  background: linear-gradient(135deg, #1e3a5f 0%, #1a1a1c 100%);
}

.card-placeholder.video {
  background: linear-gradient(135deg, #3d1a5f 0%, #1a1a1c 100%);
}

.card-placeholder.audio {
  background: linear-gradient(135deg, #1a5f3d 0%, #1a1a1c 100%);
}

.placeholder-icon {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.4);
}

.placeholder-text {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.3;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 视频标识 */
.video-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 8px;
}

/* 悬停信息遮罩 */
.hover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overlay-model {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
  width: fit-content;
}

.overlay-prompt {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.overlay-time {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
}

.overlay-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.overlay-delete:hover {
  background: #ef4444;
  color: #fff;
}

/* 底部 */
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.stats {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
}

/* 动画 */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

.panel-enter-from .history-panel,
.panel-leave-to .history-panel {
  transform: translateX(-20px);
  opacity: 0;
}

/* ========== 全屏预览模态框 ========== */
.history-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-preview-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  max-height: 90vh;
  margin: auto;
  position: relative;
}

/* 关闭按钮 */
.close-preview-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.close-preview-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 预览内容区域 */
.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  cursor: grab;
  padding: 20px;
}

.preview-content.dragging {
  cursor: grabbing;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s ease-out;
  user-select: none;
  -webkit-user-drag: none;
  border-radius: 8px;
}

.preview-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  background: #000;
}

.preview-audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.preview-audio .audio-icon {
  font-size: 48px;
  color: rgba(255, 255, 255, 0.4);
}

.audio-player {
  width: 320px;
  max-width: 100%;
}

/* 底部信息和操作栏 */
.preview-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(20, 20, 22, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-info-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.info-tag {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.08);
  padding: 4px 10px;
  border-radius: 4px;
}

/* 提示词 */
.preview-prompt {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  text-align: center;
  max-height: 60px;
  overflow-y: auto;
  padding: 0 20px;
}

/* 操作按钮组 */
.preview-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding-top: 8px;
}

.preview-actions .action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-actions .action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.preview-actions .apply-btn {
  background: #fff;
  border-color: #fff;
  color: #000;
}

.preview-actions .apply-btn:hover {
  background: #f0f0f0;
}

.preview-actions .download-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.preview-actions .delete-btn:hover {
  background: rgba(239, 68, 68, 0.6);
  border-color: rgba(239, 68, 68, 0.8);
}

/* 预览动画 */
.preview-enter-active,
.preview-leave-active {
  transition: all 0.25s ease;
}

.preview-enter-from,
.preview-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 800px) {
  .history-panel-overlay {
    padding: 20px;
    align-items: center;
    justify-content: center;
  }
  
  .history-panel {
    width: 100%;
    max-width: 480px;
    max-height: calc(100vh - 40px);
  }
  
  .waterfall-grid {
    columns: 2;
  }
  
  .preview-actions {
    flex-wrap: wrap;
  }
  
  .preview-actions .action-btn {
    flex: 1;
    min-width: 100px;
    justify-content: center;
  }
}

/* ========== 删除确认弹窗 ========== */
.delete-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10100;
}

.delete-confirm-modal {
  background: linear-gradient(145deg, #1e1e22, #141417);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 32px 40px;
  min-width: 320px;
  max-width: 400px;
  text-align: center;
  box-shadow: 
    0 25px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  animation: modal-scale-in 0.2s ease-out;
}

@keyframes modal-scale-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.delete-modal-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
}

.delete-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.delete-modal-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 20px;
}

.delete-modal-preview {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.delete-modal-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.delete-modal-preview .preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent);
}

.delete-modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.confirm-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #f87171, #ef4444);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
}

.confirm-btn:active {
  transform: translateY(0);
}

/* 弹窗动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .delete-confirm-modal,
.modal-fade-leave-to .delete-confirm-modal {
  transform: scale(0.9) translateY(10px);
}
</style>
