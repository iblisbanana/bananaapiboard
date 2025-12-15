<script setup>
/**
 * NodeContextMenu.vue - 节点右键菜单
 * 支持所有节点类型的"加入我的资产"功能
 */
import { ref, computed } from 'vue'
import { useI18n } from '@/i18n'
import { useCanvasStore } from '@/stores/canvas'
import { getDownstreamOptions } from '@/config/canvas/nodeTypes'
import { getTenantHeaders } from '@/config/tenant'
import { saveAsset } from '@/api/canvas/assets'

const { t } = useI18n()

const props = defineProps({
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  node: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])
const canvasStore = useCanvasStore()

// 加入资产的加载状态
const isAddingAsset = ref(false)

// ========== 节点类型判断 ==========

// 判断节点类型
const nodeType = computed(() => props.node?.type || '')

// 判断是否是视频节点且有输出
const isVideoNodeWithOutput = computed(() => {
  if (!props.node) return false
  const type = nodeType.value
  const isVideoType = type === 'video' || type === 'video-input' || type === 'video-gen' || 
                      type === 'text-to-video' || type === 'image-to-video'
  return isVideoType && props.node.data?.output?.url
})

// 判断是否是图片节点且有输出
const isImageNodeWithOutput = computed(() => {
  if (!props.node) return false
  const type = nodeType.value
  const isImageType = type === 'image' || type === 'image-input' || type === 'image-gen' ||
                      type === 'text-to-image' || type === 'preview' || type === 'preview-output'
  const hasOutput = props.node.data?.output?.url || 
                    props.node.data?.output?.urls?.length > 0 ||
                    props.node.data?.imageUrl || 
                    props.node.data?.generatedImage ||
                    props.node.data?.url
  return isImageType && hasOutput
})

// 判断是否是文本节点且有内容
const isTextNodeWithContent = computed(() => {
  if (!props.node) return false
  const type = nodeType.value
  const isTextType = type === 'text' || type === 'text-input' || type === 'llm'
  // TextNode 使用 data.text，LLMNode 使用 data.output.content
  const hasContent = props.node.data?.text || 
                     props.node.data?.output?.content ||
                     props.node.data?.content ||
                     props.node.data?.llmResponse
  return isTextType && hasContent
})

// 判断是否是音频节点且有输出
const isAudioNodeWithOutput = computed(() => {
  if (!props.node) return false
  const type = nodeType.value
  const isAudioType = type === 'audio' || type === 'audio-input' || type === 'audio-gen' ||
                      type === 'text-to-audio' || type === 'tts'
  const hasOutput = props.node.data?.output?.url || props.node.data?.audioUrl
  return isAudioType && hasOutput
})

// 判断是否可以加入资产
const canAddToAssets = computed(() => {
  return isVideoNodeWithOutput.value || 
         isImageNodeWithOutput.value || 
         isTextNodeWithContent.value || 
         isAudioNodeWithOutput.value
})

// 获取资产类型
const assetType = computed(() => {
  if (isVideoNodeWithOutput.value) return 'video'
  if (isImageNodeWithOutput.value) return 'image'
  if (isTextNodeWithContent.value) return 'text'
  if (isAudioNodeWithOutput.value) return 'audio'
  return null
})

// 获取资产类型标签
const assetTypeLabel = computed(() => {
  const labelKeys = {
    'video': 'canvas.contextMenu.videoActions',
    'image': 'canvas.contextMenu.imageActions',
    'text': 'canvas.contextMenu.textActions',
    'audio': 'canvas.contextMenu.audioActions'
  }
  const key = labelKeys[assetType.value] || 'canvas.contextMenu.contentActions'
  return t(key)
})

// 获取资产类型名称（用于保存时显示）
const assetTypeName = computed(() => {
  const names = {
    'video': t('canvas.nodes.video'),
    'image': t('canvas.nodes.image'),
    'text': t('canvas.nodes.text'),
    'audio': t('canvas.nodes.audio')
  }
  return names[assetType.value] || t('canvas.nodes.text')
})

// ========== 获取节点内容 ==========

// 获取视频URL
const videoUrl = computed(() => {
  if (!props.node?.data?.output?.url) return ''
  const url = props.node.data.output.url
  if (url.startsWith('/api/')) return url
  const match = url.match(/\/api\/images\/file\/[a-zA-Z0-9-]+/)
  if (match) return match[0]
  return url
})

// 获取图片URL（如果有多张图片，取第一张）
const imageUrl = computed(() => {
  const data = props.node?.data
  if (!data) return ''
  // 优先使用 output.url，其次 output.urls[0]
  if (data.output?.url) return data.output.url
  if (data.output?.urls?.length > 0) return data.output.urls[0]
  return data.imageUrl || data.generatedImage || data.url || ''
})

// 获取文本内容
const textContent = computed(() => {
  const data = props.node?.data
  if (!data) return ''
  // TextNode 使用 data.text，LLMNode 使用 data.output.content
  return data.text || data.output?.content || data.content || data.llmResponse || ''
})

// 获取音频URL
const audioUrl = computed(() => {
  const data = props.node?.data
  if (!data) return ''
  return data.output?.url || data.audioUrl || ''
})

// 获取资产URL或内容
const assetUrlOrContent = computed(() => {
  if (isVideoNodeWithOutput.value) return videoUrl.value
  if (isImageNodeWithOutput.value) return imageUrl.value
  if (isTextNodeWithContent.value) return textContent.value
  if (isAudioNodeWithOutput.value) return audioUrl.value
  return ''
})

// 全屏预览状态
const isFullscreenPreview = ref(false)
const fullscreenVideoUrl = ref('')

// 可连接的下游节点类型
const downstreamOptions = computed(() => {
  if (!props.node) return []
  return getDownstreamOptions(props.node.type)
})

// 菜单位置样式
const menuStyle = computed(() => {
  let x = props.position.x
  let y = props.position.y
  
  const menuWidth = 200
  const menuHeight = 450
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 20
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 20
  }
  
  return {
    left: `${x}px`,
    top: `${y}px`
  }
})

// ========== 节点操作 ==========

// 从当前节点创建下游节点
function createDownstreamNode(type) {
  if (!props.node) return
  
  const position = {
    x: props.node.position.x + 300,
    y: props.node.position.y
  }
  
  const newNode = canvasStore.addNode({
    type,
    position,
    data: {}
  })
  
  canvasStore.addEdge({
    source: props.node.id,
    target: newNode.id
  })
  
  emit('close')
}

// 编辑节点
function editNode() {
  canvasStore.selectNode(props.node.id)
  emit('close')
}

// 复制节点
function copyNode() {
  alert('复制功能开发中...')
  emit('close')
}

// 删除节点
function deleteNode() {
  if (props.node) {
    canvasStore.removeNode(props.node.id)
  }
  emit('close')
}

// ========== 视频节点特有功能 ==========

// 全屏预览视频
function fullscreenPreview() {
  if (!videoUrl.value) return
  fullscreenVideoUrl.value = videoUrl.value
  isFullscreenPreview.value = true
}

// 关闭全屏预览
function closeFullscreenPreview() {
  isFullscreenPreview.value = false
  fullscreenVideoUrl.value = ''
  emit('close')
}

// 下载视频
async function downloadVideo() {
  if (!videoUrl.value) return
  
  try {
    const response = await fetch(videoUrl.value, {
      headers: getTenantHeaders()
    })
    const blob = await response.blob()
    
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video_${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    emit('close')
  } catch (error) {
    console.error('下载视频失败:', error)
    window.open(videoUrl.value, '_blank')
    emit('close')
  }
}

// ========== 图片节点功能 ==========

// 下载图片
async function downloadImage() {
  if (!imageUrl.value) return
  
  try {
    const response = await fetch(imageUrl.value, {
      headers: getTenantHeaders()
    })
    const blob = await response.blob()
    
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image_${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    emit('close')
  } catch (error) {
    console.error('下载图片失败:', error)
    window.open(imageUrl.value, '_blank')
    emit('close')
  }
}

// ========== 通用资产功能 ==========

// 加入我的资产（通用方法，支持所有类型）
async function addToMyAssets() {
  if (!canAddToAssets.value || isAddingAsset.value) return
  
  isAddingAsset.value = true
  
  try {
    const type = assetType.value
    const now = new Date()
    const timeStr = now.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    // 构建资产数据
    const assetData = {
      type,
      name: `${assetTypeName.value}_${timeStr}`,
      source_node_id: props.node?.id,
      source: 'canvas',
      tags: [assetTypeName.value, t('canvas.contextMenu.canvasGenerated')]
    }
    
    // 根据类型设置内容
    if (type === 'text') {
      assetData.content = textContent.value
      // 使用内容前30个字符作为名称
      const shortContent = textContent.value.slice(0, 30).replace(/\n/g, ' ')
      assetData.name = shortContent + (textContent.value.length > 30 ? '...' : '')
    } else if (type === 'image') {
      assetData.url = imageUrl.value
    } else if (type === 'video') {
      assetData.url = videoUrl.value
    } else if (type === 'audio') {
      assetData.url = audioUrl.value
    }
    
    // 调用API保存
    const result = await saveAsset(assetData)
    
    if (result.success) {
      // 显示成功提示
      showToast(t('canvas.contextMenu.assetSaved', { type: assetTypeName.value }), 'success')
    } else {
      throw new Error(result.error || t('common.failed'))
    }
  } catch (error) {
    console.error('加入资产失败:', error)
    showToast(t('common.failed') + '：' + (error.message || t('common.unknownError')), 'error')
  } finally {
    isAddingAsset.value = false
    emit('close')
  }
}

// 简单的Toast提示
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `asset-toast asset-toast-${type}`
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-text">${message}</span>
  `
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? 'rgba(34, 197, 94, 0.95)' : type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 10001;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: toastIn 0.3s ease;
  `
  
  // 添加动画样式
  const style = document.createElement('style')
  style.textContent = `
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes toastOut {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(toast)
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards'
    setTimeout(() => {
      toast.remove()
      style.remove()
    }, 300)
  }, 2500)
}

// 阻止点击冒泡
function handleMenuClick(event) {
  event.stopPropagation()
}
</script>

<template>
  <div 
    class="canvas-context-menu" 
    :style="menuStyle"
    @click="handleMenuClick"
  >
    <!-- 资产操作（所有可保存类型通用） -->
    <template v-if="canAddToAssets">
      <div class="canvas-context-menu-title">{{ assetTypeLabel }}</div>
      
      <!-- 视频特有选项 -->
      <template v-if="isVideoNodeWithOutput">
        <div class="canvas-context-menu-item" @click="fullscreenPreview">
          <span class="icon">🔍</span>
          {{ $t('canvas.contextMenu.fullscreenPreview') }}
        </div>
        <div class="canvas-context-menu-item" @click="downloadVideo">
          <span class="icon">⬇️</span>
          {{ $t('canvas.contextMenu.downloadVideo') }}
        </div>
      </template>
      
      <!-- 图片特有选项 -->
      <template v-if="isImageNodeWithOutput">
        <div class="canvas-context-menu-item" @click="downloadImage">
          <span class="icon">⬇️</span>
          {{ $t('canvas.contextMenu.downloadImage') }}
        </div>
      </template>
      
      <!-- 通用的加入资产选项 -->
      <div 
        class="canvas-context-menu-item asset-item"
        :class="{ loading: isAddingAsset }"
        @click="addToMyAssets"
      >
        <span class="icon">{{ isAddingAsset ? '⏳' : '💾' }}</span>
        <span v-if="isAddingAsset">{{ $t('canvas.contextMenu.saving') }}</span>
        <span v-else>{{ $t('canvas.contextMenu.addToAssets') }}</span>
        <span class="permanent-badge">{{ $t('canvas.contextMenu.permanent') }}</span>
      </div>
      
      <div class="canvas-context-menu-divider"></div>
    </template>
    
    <!-- 引用该节点生成 -->
    <template v-if="downstreamOptions.length > 0">
      <div class="canvas-context-menu-title">{{ $t('canvas.referenceGenerate') }}</div>
      <div 
        v-for="option in downstreamOptions.slice(0, 4)" 
        :key="option.type"
        class="canvas-context-menu-item"
        @click="createDownstreamNode(option.type)"
      >
        <span class="icon">{{ option.icon }}</span>
        {{ $t(option.label) }}
      </div>
      <div class="canvas-context-menu-divider"></div>
    </template>
    
    <!-- 节点操作 -->
    <div class="canvas-context-menu-item" @click="editNode">
      <span class="icon">✏️</span>
      {{ $t('canvas.contextMenu.editNode') }}
    </div>
    <div class="canvas-context-menu-item" @click="copyNode">
      <span class="icon">📋</span>
      {{ $t('canvas.contextMenu.copyNode') }}
    </div>
    <div class="canvas-context-menu-item delete-item" @click="deleteNode">
      <span class="icon">🗑</span>
      {{ $t('canvas.contextMenu.deleteNode') }}
    </div>
  </div>
  
  <!-- 全屏预览模态框 -->
  <Teleport to="body">
    <div v-if="isFullscreenPreview" class="fullscreen-preview-overlay" @click="closeFullscreenPreview">
      <div class="fullscreen-preview-container" @click.stop>
        <video 
          :src="fullscreenVideoUrl" 
          controls 
          autoplay
          class="fullscreen-video"
        ></video>
        <button class="fullscreen-close-btn" @click="closeFullscreenPreview">
          ✕
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 右键菜单样式已在 canvas.css 中定义 */

/* 资产相关样式 */
.asset-item {
  position: relative;
}

.asset-item.loading {
  opacity: 0.7;
  pointer-events: none;
}

.permanent-badge {
  margin-left: auto;
  padding: 2px 6px;
  font-size: 10px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #000;
  border-radius: 4px;
  font-weight: 600;
}

.delete-item:hover {
  background: rgba(239, 68, 68, 0.2) !important;
  color: #f87171;
}

/* 全屏预览模态框 */
.fullscreen-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
}

.fullscreen-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.fullscreen-video {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.fullscreen-close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.fullscreen-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}
</style>
