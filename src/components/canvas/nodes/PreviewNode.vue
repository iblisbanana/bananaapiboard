<script setup>
/**
 * PreviewNode.vue - 预览输出节点
 */
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const canvasStore = useCanvasStore()

// 节点样式类
const nodeClass = computed(() => ({
  'canvas-node': true,
  'selected': props.selected
}))

// 继承的数据
const inheritedData = computed(() => props.data.inheritedData)
const contentType = computed(() => inheritedData.value?.type || 'none')

// 打开右键菜单
function handleContextMenu(event) {
  event.preventDefault()
  canvasStore.openContextMenu(
    { x: event.clientX, y: event.clientY },
    { id: props.id, type: 'preview-output', position: { x: 0, y: 0 }, data: props.data }
  )
}

// 下载
function download() {
  if (contentType.value === 'image' && inheritedData.value?.urls?.length) {
    window.open(inheritedData.value.urls[0], '_blank')
  } else if (contentType.value === 'video' && inheritedData.value?.url) {
    window.open(inheritedData.value.url, '_blank')
  }
}

// 全屏预览
function fullscreen() {
  alert('全屏预览功能开发中...')
}
</script>

<template>
  <div :class="nodeClass" @contextmenu="handleContextMenu">
    <!-- 节点头部 -->
    <div class="canvas-node-header">
      <div class="canvas-node-title">
        <span class="icon">◉</span>
        {{ data.title || '预览输出' }}
      </div>
      <div class="canvas-node-actions">
        <button class="canvas-node-action-btn" title="下载" @click="download">↓</button>
        <button class="canvas-node-action-btn" title="全屏" @click="fullscreen">⤢</button>
      </div>
    </div>
    
    <!-- 节点内容 -->
    <div class="canvas-node-content">
      <div class="canvas-node-preview">
        <!-- 文本预览 -->
        <div v-if="contentType === 'text'" class="preview-text">
          {{ inheritedData?.content || '无内容' }}
        </div>
        
        <!-- 图片预览 -->
        <img 
          v-else-if="contentType === 'image' && inheritedData?.urls?.length" 
          :src="inheritedData.urls[0]" 
          alt="预览"
        />
        
        <!-- 视频预览 -->
        <video 
          v-else-if="contentType === 'video' && inheritedData?.url"
          :src="inheritedData.url"
          controls
          class="preview-video"
        ></video>
        
        <!-- 空状态 -->
        <div v-else class="canvas-node-preview-empty">
          等待上游节点输出...
        </div>
      </div>
    </div>
    
    <!-- 输入端口（隐藏但保留给 Vue Flow 用于边渲染） -->
    <Handle
      type="target"
      :position="Position.Left"
      id="input"
      class="node-handle node-handle-hidden"
    />
  </div>
</template>

<style scoped>
.preview-text {
  padding: 12px;
  color: var(--canvas-text-primary);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.canvas-node-preview img {
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
  border-radius: var(--canvas-radius-sm);
}

.preview-video {
  max-width: 100%;
  max-height: 250px;
  border-radius: var(--canvas-radius-sm);
}

/* 端口样式 - 完全隐藏（但保留给 Vue Flow 用于边渲染） */
.node-handle {
  width: 1px;
  height: 1px;
  background: transparent;
  border: none;
  opacity: 0;
  pointer-events: none;
}

.node-handle-hidden {
  opacity: 0 !important;
  visibility: hidden;
  pointer-events: none;
}
</style>

