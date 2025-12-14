<script setup>
/**
 * NodeSelector.vue - 节点选择器面板
 */
import { ref, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { NODE_TYPES, NODE_TYPE_CONFIG, NODE_CATEGORIES, getDownstreamOptions, getUpstreamOptions } from '@/config/canvas/nodeTypes'

const props = defineProps({
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  trigger: {
    type: String,
    default: 'canvas' // 'toolbar' | 'canvas' | 'node'
  },
  triggerNodeId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])
const canvasStore = useCanvasStore()

// 文件上传输入框引用
const fileInputRef = ref(null)

// 选中的节点类型
const selectedType = ref(null)

// 获取触发节点
const triggerNode = computed(() => {
  if (!props.triggerNodeId) return null
  return canvasStore.nodes.find(n => n.id === props.triggerNodeId)
})

// 是否是左侧添加（添加上游节点）
const isLeftTrigger = computed(() => props.trigger === 'node-left')

// 可选节点类型列表
const availableNodes = computed(() => {
  // 如果是从节点创建
  if (triggerNode.value) {
    // 左侧添加 = 添加上游节点
    if (isLeftTrigger.value) {
      return getUpstreamOptions(triggerNode.value.type)
    }
    // 右侧添加 = 添加下游节点
    return getDownstreamOptions(triggerNode.value.type)
  }
  
  // 否则显示输入类节点
  return NODE_CATEGORIES.input.types.map(type => ({
    type,
    ...NODE_TYPE_CONFIG[type]
  }))
})

// 面板位置样式
const panelStyle = computed(() => {
  let x = props.position.x
  let y = props.position.y
  
  // 确保不超出屏幕
  const panelWidth = 240
  const panelHeight = 300
  
  if (x + panelWidth > window.innerWidth) {
    x = window.innerWidth - panelWidth - 20
  }
  if (y + panelHeight > window.innerHeight) {
    y = window.innerHeight - panelHeight - 20
  }
  
  return {
    left: `${x}px`,
    top: `${y}px`
  }
})

// LLM 预设映射表：将 LLM 节点类型映射到文本节点 + 预设
const LLM_PRESET_MAP = {
  'llm-prompt-enhance': 'prompt-enhance',
  'llm-content-expand': 'content-expand',
  'llm-storyboard': 'storyboard'
}

// 选择节点类型
function selectNodeType(type) {
  selectedType.value = type
  
  // 计算新节点位置
  let position = { x: 200, y: 200 }
  
  // 优先使用 store 中传入的 flowPosition
  if (canvasStore.nodeSelectorFlowPosition) {
    position = { ...canvasStore.nodeSelectorFlowPosition }
    
    // 稍微偏移一点，让节点中心对准鼠标（假设节点宽240）
    position.x -= 120
    position.y -= 50
  } else if (triggerNode.value) {
    if (isLeftTrigger.value) {
      // 左侧添加：在触发节点左侧创建
      position = {
        x: triggerNode.value.position.x - 450,
        y: triggerNode.value.position.y
      }
    } else {
      // 右侧添加：在触发节点右侧创建
      position = {
        x: triggerNode.value.position.x + 400,
        y: triggerNode.value.position.y
      }
    }
  } else if (props.trigger === 'canvas') {
    // Fallback: 如果没有 flowPosition (例如点击工具栏添加)，则使用默认位置或基于屏幕位置估算
    position = {
      x: 100,
      y: 100
    }
  }
  
  // 准备节点初始数据
  const nodeData = {}
  
  // 检查是否是 LLM 预设类型，如果是，转换为文本节点 + 预设
  let actualNodeType = type
  if (LLM_PRESET_MAP[type]) {
    actualNodeType = 'text-input'
    nodeData.selectedPreset = LLM_PRESET_MAP[type]
    nodeData.title = NODE_TYPE_CONFIG[type]?.label || '文本'
  }
  
  // 右侧添加：新节点接收来自触发节点的数据
  if (triggerNode.value && !isLeftTrigger.value) {
    nodeData.hasUpstream = true
    nodeData.inheritedFrom = props.triggerNodeId
    
    // 从上游节点继承相关数据
    const sourceData = triggerNode.value.data
    if (sourceData) {
      // 如果上游是图片节点，传递图片作为参考
      if (sourceData.sourceImages?.length > 0) {
        nodeData.referenceImages = [...sourceData.sourceImages]
        nodeData.inheritedData = {
          type: 'image',
          urls: sourceData.sourceImages
        }
      } else if (sourceData.output?.urls?.length > 0) {
        // 上游节点有输出结果
        nodeData.referenceImages = [...sourceData.output.urls]
        nodeData.inheritedData = {
          type: 'image',
          urls: sourceData.output.urls
        }
      } else if (sourceData.text) {
        // 文本节点传递文本
        nodeData.inheritedData = {
          type: 'text',
          content: sourceData.text
        }
      }
    }
  }
  
  console.log('[NodeSelector] 创建节点:', { 
    type: actualNodeType,
    originalType: type,
    position, 
    nodeData, 
    triggerNodeId: props.triggerNodeId,
    isLeftTrigger: isLeftTrigger.value
  })
  
  // 保存触发节点ID（因为 addNode 可能会清除它）
  const savedTriggerNodeId = props.triggerNodeId
  const savedTriggerNode = triggerNode.value
  
  // 左侧添加时，先清除 store 中的 triggerNodeId，防止 addNode 自动创建错误方向的连线
  if (isLeftTrigger.value && savedTriggerNodeId) {
    canvasStore.triggerNodeId = null
  }
  
  // 创建节点（使用 actualNodeType 而不是 type）
  const newNode = canvasStore.addNode({
    type: actualNodeType,
    position,
    data: nodeData
  })
  
  // 如果有触发节点，手动创建正确方向的连接
  if (savedTriggerNode && newNode?.id) {
    if (isLeftTrigger.value) {
      // 左侧添加：新节点 → 触发节点（新节点是上游，触发节点是下游）
      // 连线方向：新节点的 output → 触发节点的 input
      canvasStore.addEdge({
        source: newNode.id,
        sourceHandle: 'output',
        target: savedTriggerNodeId,
        targetHandle: 'input'
      })
      // 更新触发节点的状态，标记有上游连接
      canvasStore.updateNodeData(savedTriggerNodeId, {
        hasUpstream: true,
        inheritedFrom: newNode.id
      })
    }
    // 右侧添加：addNode 内部已经自动创建了正确方向的连接（触发节点 → 新节点）
  }
  
  emit('close')
}

// 阻止点击冒泡
function handlePanelClick(event) {
  event.stopPropagation()
}

// 打开文件选择对话框
function handleUploadClick() {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

// 处理文件上传
async function handleFileUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  // 计算节点位置
  let position = { x: 200, y: 200 }
  if (canvasStore.nodeSelectorFlowPosition) {
    position = { ...canvasStore.nodeSelectorFlowPosition }
    position.x -= 120
    position.y -= 50
  } else {
    position = { x: 100, y: 100 }
  }
  
  // 处理每个文件
  let offsetX = 0
  let offsetY = 0
  
  for (const file of files) {
    const fileType = file.type
    
    try {
      // 根据文件类型创建不同的节点
      let nodeType = null
      let nodeData = {}
      
      // 图片文件 - 与拖拽上传保持一致
      if (fileType.startsWith('image/')) {
        const dataUrl = await readFileAsBase64(file)
        nodeType = 'image-input'
        nodeData = {
          title: file.name || '图片',
          nodeRole: 'source',
          sourceImages: [dataUrl]
        }
      }
      // 视频文件 - 与拖拽上传保持一致
      else if (fileType.startsWith('video/')) {
        const dataUrl = await readFileAsBase64(file)
        nodeType = 'video'
        nodeData = {
          title: file.name || '视频',
          status: 'success',
          output: {
            type: 'video',
            url: dataUrl
          }
        }
      }
      // 音频文件 - 与拖拽上传保持一致
      else if (fileType.startsWith('audio/')) {
        const dataUrl = await readFileAsBase64(file)
        nodeType = 'text-input'
        nodeData = {
          title: `🎵 ${file.name || '音频'}`,
          text: `音频文件: ${file.name}`,
          audioData: dataUrl
        }
      }
      // 文本文件
      else if (fileType.startsWith('text/') || 
               fileType === 'application/json' ||
               file.name.endsWith('.txt') ||
               file.name.endsWith('.md') ||
               file.name.endsWith('.json')) {
        const textContent = await readFileAsText(file)
        nodeType = 'text-input'
        nodeData = {
          title: file.name,
          text: textContent
        }
      }
      // 其他文件类型
      else {
        nodeType = 'text-input'
        nodeData = {
          title: file.name,
          text: `已上传文件: ${file.name}\n类型: ${fileType}\n大小: ${formatFileSize(file.size)}`
        }
      }
      
      // 创建节点
      if (nodeType) {
        const nodePosition = {
          x: position.x + offsetX,
          y: position.y + offsetY
        }
        
        canvasStore.addNode({
          type: nodeType,
          position: nodePosition,
          data: nodeData
        })
        
        // 多文件时错开位置
        offsetX += 50
        offsetY += 50
      }
      
    } catch (error) {
      console.error('[NodeSelector] 文件上传失败:', error, file.name)
    }
  }
  
  // 清空文件选择，允许重复上传同一文件
  event.target.value = ''
  
  // 关闭面板
  emit('close')
}

// 读取文件为 Base64（与 CanvasBoard 中的实现保持一致）
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 读取文件为文本
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>

<template>
  <div 
    class="node-selector" 
    :style="panelStyle"
    @click="handlePanelClick"
  >
    <!-- 标题 -->
    <div class="node-selector-title">
      {{ triggerNode ? (isLeftTrigger ? '添加上游输入' : '引用该节点生成') : '添加节点' }}
    </div>
    
    <!-- 节点列表 -->
    <template v-if="availableNodes.length > 0">
      <div 
        v-for="node in availableNodes" 
        :key="node.type"
        class="node-selector-item"
        :class="{ selected: selectedType === node.type }"
        @click="selectNodeType(node.type)"
      >
        <div class="node-selector-icon">{{ node.icon }}</div>
        <div class="node-selector-info">
          <div class="node-selector-name">{{ node.label }}</div>
          <div class="node-selector-desc" v-if="node.description">{{ node.description }}</div>
        </div>
      </div>
    </template>
    
    <!-- 无可用节点提示 -->
    <div v-else class="node-selector-empty">
      <div class="empty-icon">🔗</div>
      <div class="empty-text">暂无可连接的节点类型</div>
    </div>
    
    <!-- 分隔线和上传选项（仅非节点触发时显示） -->
    <template v-if="!triggerNode">
      <div class="node-selector-divider"></div>
      <div class="node-selector-title">添加资源</div>
      <div class="node-selector-item" @click="handleUploadClick">
        <div class="node-selector-icon">⬆</div>
        <div class="node-selector-info">
          <div class="node-selector-name">上传</div>
        </div>
      </div>
    </template>
    
    <!-- 隐藏的文件上传输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="*/*"
      style="display: none"
      @change="handleFileUpload"
    />
  </div>
</template>

<style scoped>
/* 节点选择器样式已在 canvas.css 中定义 */

/* 空状态提示 */
.node-selector-empty {
  padding: 24px 16px;
  text-align: center;
}

.node-selector-empty .empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.6;
}

.node-selector-empty .empty-text {
  color: var(--canvas-text-tertiary, #666);
  font-size: 13px;
}
</style>

