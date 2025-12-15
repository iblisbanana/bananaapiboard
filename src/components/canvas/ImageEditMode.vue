<script setup>
/**
 * ImageEditMode.vue - 图片编辑模式容器
 * 
 * 当用户点击图片工具栏进入编辑模式时显示
 * 功能：
 * - 全屏覆盖层，显示功能强大的图片编辑器
 * - 使用 Toast UI Image Editor 提供完整的编辑功能
 * - 处理保存和取消操作
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import NativeImageEditor from './NativeImageEditor.vue'

const canvasStore = useCanvasStore()

// 编辑器引用
const editorRef = ref(null)

// 编辑区域尺寸（动态计算）
const editorWidth = ref(800)
const editorHeight = ref(600)

// 当前编辑的节点
const editingNode = computed(() => {
  if (!canvasStore.editingNodeId) return null
  return canvasStore.nodes.find(n => n.id === canvasStore.editingNodeId)
})

// 当前图片URL
const currentImageUrl = computed(() => {
  if (!editingNode.value) return null
  const node = editingNode.value
  
  // 优先获取输出图片
  if (node.data?.output?.urls?.length > 0) {
    return node.data.output.urls[0]
  }
  if (node.data?.output?.url) {
    return node.data.output.url
  }
  // 其次获取源图片
  if (node.data?.sourceImages?.length > 0) {
    return node.data.sourceImages[0]
  }
  return null
})

// 当前编辑工具
const currentTool = computed(() => canvasStore.editTool)

// 是否显示编辑模式（排除重绘和擦除，这些由 InplaceImageEditor 处理）
const isVisible = computed(() => {
  if (!canvasStore.isInEditMode || !currentImageUrl.value) return false
  // 重绘和擦除使用原地编辑器
  if (['repaint', 'erase'].includes(currentTool.value)) return false
  return true
})

// 映射工具到 TUI 编辑器的初始模式
const initialTool = computed(() => {
  const toolMap = {
    'crop': 'crop',
    'repaint': 'mask',
    'erase': 'mask',
    'annotate': 'draw',
    'enhance': 'filter',
    'cutout': '',
    'expand': ''
  }
  return toolMap[currentTool.value] || ''
})

// 工具标题
const toolTitle = computed(() => {
  const titles = {
    repaint: '重绘蒙版',
    erase: '擦除区域',
    annotate: '涂鸦标注',
    crop: '裁剪图片',
    enhance: '图像增强',
    cutout: '智能抠图',
    expand: '智能扩图'
  }
  return titles[currentTool.value] || '图片编辑'
})

// 计算编辑区域尺寸
function calculateEditorSize() {
  const padding = 100 // 边距
  const toolbarHeight = 60 // 工具栏高度
  
  editorWidth.value = Math.min(window.innerWidth - padding * 2, 1200)
  editorHeight.value = Math.min(window.innerHeight - padding * 2 - toolbarHeight, 800)
}

// 处理保存
async function handleSave(data) {
  console.log('[ImageEditMode] 保存编辑结果', data)
  
  if (!editingNode.value || !data) {
    canvasStore.exitEditMode()
    return
  }
  
  try {
    // 如果有图片数据，直接保存
    if (data.image) {
      await updateNodeImage(data.image)
      
      // 如果是蒙版模式，可能需要调用 AI API
      if (data.hasMask && ['repaint', 'erase'].includes(currentTool.value)) {
        console.log('[ImageEditMode] 蒙版已生成，准备调用 AI API')
        // TODO: 调用后端 AI 接口进行重绘/擦除
      }
    }
  } catch (error) {
    console.error('[ImageEditMode] 保存失败:', error)
    alert('保存失败，请重试')
  }
  
  canvasStore.exitEditMode()
}

// 更新节点图片
async function updateNodeImage(dataUrl) {
  if (!editingNode.value) return
  
  // 将 dataUrl 转换为 File 并上传
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' })
  
  // 动态导入上传函数
  const { uploadImages } = await import('@/api/canvas/nodes')
  const uploadResult = await uploadImages([file])
  
  if (uploadResult?.urls?.length > 0) {
    const newUrl = uploadResult.urls[0]
    const node = editingNode.value
    
    // 更新节点数据
    if (node.data?.output?.urls?.length > 0) {
      canvasStore.updateNodeData(node.id, {
        output: {
          ...node.data.output,
          urls: [newUrl, ...(node.data.output.urls.slice(1) || [])]
        }
      })
    } else if (node.data?.sourceImages?.length > 0) {
      canvasStore.updateNodeData(node.id, {
        sourceImages: [newUrl, ...(node.data.sourceImages.slice(1) || [])]
      })
    }
    
    console.log('[ImageEditMode] 图片已更新:', newUrl)
  }
}

// 处理取消
function handleCancel() {
  canvasStore.exitEditMode()
}

// ESC 退出
function handleKeyDown(event) {
  if (event.key === 'Escape' && isVisible.value) {
    handleCancel()
  }
}

// 监听窗口大小变化
function handleResize() {
  calculateEditorSize()
}

onMounted(() => {
  calculateEditorSize()
  window.addEventListener('resize', handleResize)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="edit-mode-fade">
      <div v-if="isVisible" class="image-edit-mode-overlay" @click.self="handleCancel">
        <div class="edit-mode-container">
          <!-- 头部 -->
          <div class="edit-mode-header">
            <div class="header-left">
              <button class="close-btn" @click="handleCancel" title="关闭 (ESC)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="edit-title">图片编辑器</span>
            </div>
            <div class="header-right">
              <span class="edit-hint">全功能图片编辑 · 按 ESC 退出</span>
            </div>
          </div>
          
          <!-- 编辑器区域 -->
          <div class="edit-mode-content">
            <!-- 原生全功能图片编辑器 -->
            <NativeImageEditor
              ref="editorRef"
              :image-url="currentImageUrl"
              :initial-tool="initialTool"
              :width="editorWidth"
              :height="editorHeight"
              @save="handleSave"
              @cancel="handleCancel"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.image-edit-mode-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-mode-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 1400px;
  max-height: 100%;
  padding: 20px;
}

/* 头部 */
.edit-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.edit-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
}

.edit-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

/* 编辑器区域 */
.edit-mode-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 占位编辑器 */
.placeholder-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.placeholder-content {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.placeholder-image {
  max-width: 800px;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.placeholder-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.placeholder-icon {
  font-size: 48px;
}

.placeholder-text {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.placeholder-hint {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.placeholder-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.action-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 动画 */
.edit-mode-fade-enter-active,
.edit-mode-fade-leave-active {
  transition: all 0.3s ease;
}

.edit-mode-fade-enter-from,
.edit-mode-fade-leave-to {
  opacity: 0;
}

.edit-mode-fade-enter-from .edit-mode-container,
.edit-mode-fade-leave-to .edit-mode-container {
  transform: scale(0.95);
}
</style>

