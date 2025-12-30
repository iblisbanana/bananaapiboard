<script setup>
/**
 * AudioNode.vue - 音频节点（统一设计）
 * 
 * 设计规范（与 VideoNode 保持一致）：
 * - 顶部标签：显示 "Audio"
 * - 主体区域：空状态显示快捷操作，有输出显示音频播放器
 * - 左侧(+)：可选输入
 * - 右侧(+)：输出连接
 * - 快捷操作：图片对口型、音频生视频、音频提取文案
 */
import { ref, computed, watch, nextTick, inject, onMounted, onUnmounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { getTenantHeaders, getAvailableMusicModels } from '@/config/tenant'
import { useI18n } from '@/i18n'
import { showAlert, showInsufficientPointsDialog } from '@/composables/useCanvasDialog'
import MusicTagsSelector from '@/components/canvas/MusicTagsSelector.vue'
import apiClient from '@/api/client'

const { t } = useI18n()

const props = defineProps({
  id: String,
  data: Object,
  selected: Boolean
})

const canvasStore = useCanvasStore()
const userInfo = inject('userInfo')

// Vue Flow 实例 - 用于在节点尺寸变化时更新连线
const { updateNodeInternals } = useVueFlow()

// 可用音乐模型列表 - 从租户配置动态获取
const musicModels = computed(() => {
  return getAvailableMusicModels()
})

// 音乐生成相关状态
const selectedMusicModel = ref(props.data.musicModel || musicModels.value[0]?.value || 'chirp-v4')
const customMode = ref(props.data.customMode || false)
const musicPrompt = ref(props.data.musicPrompt || '')
const title = ref(props.data.title || '')
const tags = ref(props.data.tags || '')
const negativeTags = ref(props.data.negativeTags || '')
const makeInstrumental = ref(props.data.makeInstrumental || false)
const isGeneratingMusic = ref(false)

// 模型下拉框状态
const isMusicModelDropdownOpen = ref(false)
const musicModelSelectorRef = ref(null)
const dropdownDirection = ref('down')

// 高级选项折叠状态
const showAdvancedOptions = ref(false)

// 当前选中模型的配置
const currentMusicModelConfig = computed(() => {
  return musicModels.value.find(m => m.value === selectedMusicModel.value) || musicModels.value[0]
})

// 音乐生成积分消耗（生成2首歌）
const musicPointsCost = computed(() => (currentMusicModelConfig.value?.pointsCost || 20) * 2)

// 用户积分
const userPoints = computed(() => {
  if (!userInfo?.value) return 0
  return (userInfo.value.package_points || 0) + (userInfo.value.points || 0)
})

// 继承的数据（来自上游节点）
const inheritedText = computed(() => props.data.inheritedData?.content || '')

// 监听继承数据，自动填充到提示词
watch(inheritedText, (newText) => {
  if (newText && !musicPrompt.value) {
    musicPrompt.value = newText
  }
}, { immediate: true })

// 切换模型下拉框
function toggleMusicModelDropdown(event) {
  event.stopPropagation()
  
  // 计算下拉方向
  if (musicModelSelectorRef.value) {
    const rect = musicModelSelectorRef.value.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const dropdownHeight = 200
    
    if (rect.bottom + dropdownHeight > viewportHeight && rect.top > dropdownHeight) {
      dropdownDirection.value = 'up'
    } else {
      dropdownDirection.value = 'down'
    }
  }
  
  isMusicModelDropdownOpen.value = !isMusicModelDropdownOpen.value
}

// 选择模型
function selectMusicModel(modelValue) {
  selectedMusicModel.value = modelValue
  isMusicModelDropdownOpen.value = false
  // 保存到节点数据
  canvasStore.updateNodeData(props.id, { musicModel: modelValue })
}

// 点击外部关闭下拉框
function handleMusicModelDropdownClickOutside(event) {
  const dropdown = event.target.closest('.music-model-selector')
  if (!dropdown) {
    isMusicModelDropdownOpen.value = false
  }
}

// 处理下拉列表滚轮事件
function handleDropdownWheel(event) {
  event.stopPropagation()
}

// 生成音乐
async function handleGenerateMusic() {
  // 检查积分
  if (userPoints.value < musicPointsCost.value) {
    await showInsufficientPointsDialog(musicPointsCost.value, userPoints.value, 1)
    return
  }

  // 检查输入
  if (!musicPrompt.value.trim()) {
    await showAlert('请输入音乐描述或歌词', '提示')
    return
  }

  // 自定义模式下必须填写歌名
  if (customMode.value && !title.value.trim()) {
    await showAlert('自定义模式需要填写歌名', '提示')
    return
  }

  isGeneratingMusic.value = true

  // 更新节点状态，保存所有参数
  canvasStore.updateNodeData(props.id, {
    status: 'processing',
    musicPrompt: musicPrompt.value,
    musicModel: selectedMusicModel.value,
    customMode: customMode.value,
    title: title.value,
    tags: tags.value,
    negativeTags: negativeTags.value,
    makeInstrumental: makeInstrumental.value
  })

  try {
    const response = await apiClient.post('/api/music/generate', {
      custom_mode: customMode.value ? '1' : '0',
      prompt: musicPrompt.value,
      title: customMode.value ? title.value : undefined,
      tags: tags.value || undefined,
      negative_tags: negativeTags.value || undefined,
      model: selectedMusicModel.value,
      make_instrumental: makeInstrumental.value ? '1' : '0'
    }, {
      headers: getTenantHeaders()
    })
    
    console.log('[AudioNode] 音乐生成任务已提交:', response.data)
    
    const taskIds = response.data.task_ids || []
    
    // 保存任务ID到节点数据
    canvasStore.updateNodeData(props.id, {
      taskIds,
      status: 'processing'
    })
    
    // 任务提交成功，立即恢复按钮状态
    isGeneratingMusic.value = false
    
    // 开始轮询任务状态
    pollMusicStatus(taskIds)
    
  } catch (error) {
    console.error('[AudioNode] 音乐生成失败:', error)
    canvasStore.updateNodeData(props.id, {
      status: 'error',
      error: error.response?.data?.error || error.message || '生成失败'
    })
    isGeneratingMusic.value = false
  }
}

// 轮询音乐生成状态
async function pollMusicStatus(taskIds) {
  const maxAttempts = 60 // 最多轮询2分钟
  let attempts = 0
  
  const poll = async () => {
    if (attempts >= maxAttempts) {
      canvasStore.updateNodeData(props.id, {
        status: 'error',
        error: '生成超时，请稍后查看历史记录'
      })
      return
    }
    
    attempts++
    
    try {
      const promises = taskIds.map(taskId =>
        apiClient.get(`/api/music/query/${taskId}`, {
          headers: getTenantHeaders()
        })
      )
      
      const responses = await Promise.all(promises)
      const histories = responses.map(r => r.data)
      
      const allCompleted = histories.every(h => h.status === 'completed')
      const anyFailed = histories.some(h => h.status === 'failed')
      const anyStreaming = histories.some(h => h.status === 'streaming')
      
      if (anyFailed) {
        const failedSong = histories.find(h => h.status === 'failed')
        canvasStore.updateNodeData(props.id, {
          status: 'error',
          error: failedSong.error_message || '生成失败',
          musicHistory: histories
        })
      } else if (allCompleted) {
        // 完成后更新节点数据
        const firstSong = histories[0]
        canvasStore.updateNodeData(props.id, {
          status: 'success',
          musicHistory: histories,
          audioUrl: firstSong.audio_url || firstSong.audio_stream_url,
          audioData: firstSong.audio_url || firstSong.audio_stream_url,
          title: firstSong.title || '生成的音乐',
          output: {
            type: 'audio',
            url: firstSong.audio_url || firstSong.audio_stream_url
          }
        })
        // 刷新用户积分
        window.dispatchEvent(new CustomEvent('user-info-updated'))
      } else if (anyStreaming) {
        canvasStore.updateNodeData(props.id, {
          status: 'streaming',
          musicHistory: histories
        })
        setTimeout(poll, 2000)
      } else {
        setTimeout(poll, 2000)
      }
      
    } catch (error) {
      console.error('[AudioNode] 轮询失败:', error)
      setTimeout(poll, 2000)
    }
  }
  
  poll()
}

// 键盘快捷键
function handleMusicKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleGenerateMusic()
  }
}

// 组件挂载时添加全局点击事件监听
onMounted(() => {
  document.addEventListener('click', handleMusicModelDropdownClickOutside)
})

// 组件卸载时移除监听
onUnmounted(() => {
  document.removeEventListener('click', handleMusicModelDropdownClickOutside)
})

// 标签编辑状态
const isEditingLabel = ref(false)
const labelInputRef = ref(null)
const localLabel = ref(props.data.label || 'Audio')

// 文件上传引用
const fileInputRef = ref(null)
const audioRef = ref(null)

// 播放状态
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(props.data.volume ?? 1) // 音量 0-1
const showVolumeIndicator = ref(false) // 是否显示音量指示器
let volumeIndicatorTimer = null

// 拖拽状态
const isDragOver = ref(false)
const dragCounter = ref(0)

// 节点尺寸 - 与 VideoNode 类似的比例
const nodeWidth = ref(props.data.width || 420)
const nodeHeight = ref(props.data.height || 280)

// 是否正在调整尺寸
const isResizing = ref(false)
const resizeHandle = ref(null)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })
let resizeRafId = null

// 节点样式类
const nodeClass = computed(() => ({
  'canvas-node': true,
  'audio-node': true,
  'selected': props.selected,
  'has-output': hasAudio.value,
  'resizing': isResizing.value
}))

// 是否显示底部配置面板 - 选中时显示
const showConfigPanel = computed(() => {
  return props.selected === true
})

// 是否有音频
const hasAudio = computed(() => {
  return props.data?.audioUrl || props.data?.output?.url || props.data?.audioData
})

// 获取音频URL
const audioUrl = computed(() => {
  return props.data?.audioUrl || props.data?.output?.url || props.data?.audioData || ''
})

// 音频标题
const audioTitle = computed(() => {
  return props.data?.title || props.data?.fileName || '音频'
})

// 节点内容样式
const contentStyle = computed(() => {
  if (hasAudio.value) {
    return { width: `${nodeWidth.value}px` }
  }
  return {
    width: `${nodeWidth.value}px`,
    minHeight: `${nodeHeight.value}px`
  }
})

// 格式化时间
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 播放进度百分比
const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (currentTime.value / duration.value) * 100
})

// 同步 label 变化
watch(() => props.data.label, (newLabel) => {
  if (newLabel !== undefined && newLabel !== localLabel.value) {
    localLabel.value = newLabel
  }
})

// 双击标签进入编辑模式
function handleLabelDoubleClick(event) {
  event.stopPropagation()
  isEditingLabel.value = true
  nextTick(() => {
    if (labelInputRef.value) {
      labelInputRef.value.focus()
      labelInputRef.value.select()
    }
  })
}

// 保存标签
function saveLabelEdit() {
  isEditingLabel.value = false
  const newLabel = localLabel.value.trim() || 'Audio'
  localLabel.value = newLabel
  canvasStore.updateNodeData(props.id, { label: newLabel })
}

// 标签输入框键盘事件
function handleLabelKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveLabelEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    isEditingLabel.value = false
    localLabel.value = props.data.label || 'Audio'
  }
}

// 快捷操作 - 简化版
const quickActions = [
  { 
    icon: '↑',
    label: '上传本地音频', 
    action: () => triggerUpload()
  },
  { 
    icon: '♫',
    label: '音频生视频', 
    action: () => handleAudioToVideo()
  }
]

// 图片对口型：创建图片节点 + 视频节点，连接 图片->视频, 音频->视频
function handleLipSync() {
  const currentNode = canvasStore.nodes.find(n => n.id === props.id)
  if (!currentNode) return
  
  // 在上方创建图片节点
  const imageNodePosition = {
    x: currentNode.position.x,
    y: currentNode.position.y - 350
  }
  const imageNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  canvasStore.addNode({
    id: imageNodeId,
    type: 'image-input',
    position: imageNodePosition,
    data: {
      title: '人物图片',
      sourceImages: ['/logo.svg'],
      status: 'success'
    }
  })
  
  // 在右侧创建视频节点
  const videoNodePosition = {
    x: currentNode.position.x + 500,
    y: currentNode.position.y - 100
  }
  const videoNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  canvasStore.addNode({
    id: videoNodeId,
    type: 'video',
    position: videoNodePosition,
    data: {
      title: t('canvas.nodes.video'),
      label: t('canvas.nodes.video'),
      status: 'idle',
      generationMode: 'lip-sync'
    }
  })
  
  // 连接图片节点到视频节点
  canvasStore.addEdge({
    source: imageNodeId,
    target: videoNodeId,
    sourceHandle: 'output',
    targetHandle: 'input'
  })
  
  // 连接当前音频节点到视频节点
  canvasStore.addEdge({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'output',
    targetHandle: 'input'
  })
  
  // 选中视频节点
  canvasStore.selectNode(videoNodeId)
}

// 音频生视频：创建视频节点，连接 音频->视频
function handleAudioToVideo() {
  const currentNode = canvasStore.nodes.find(n => n.id === props.id)
  if (!currentNode) return
  
  // 在右侧创建视频节点
  const videoNodePosition = {
    x: currentNode.position.x + 500,
    y: currentNode.position.y
  }
  const videoNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  canvasStore.addNode({
    id: videoNodeId,
    type: 'video',
    position: videoNodePosition,
    data: {
      title: t('canvas.nodes.video'),
      label: t('canvas.nodes.video'),
      status: 'idle',
      generationMode: 'audio-to-video'
    }
  })
  
  // 连接当前音频节点到视频节点
  canvasStore.addEdge({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'output',
    targetHandle: 'input'
  })
  
  // 选中视频节点
  canvasStore.selectNode(videoNodeId)
}

// 音频提取文案：创建文本节点，连接 音频->文本
function handleAudioToText() {
  const currentNode = canvasStore.nodes.find(n => n.id === props.id)
  if (!currentNode) return
  
  // 在右侧创建文本节点
  const textNodePosition = {
    x: currentNode.position.x + 500,
    y: currentNode.position.y
  }
  const textNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  canvasStore.addNode({
    id: textNodeId,
    type: 'text-input',
    position: textNodePosition,
    data: {
      title: '提取文案',
      text: '',
      placeholder: '音频转文字结果将显示在这里...'
    }
  })
  
  // 连接当前音频节点到文本节点
  canvasStore.addEdge({
    source: props.id,
    target: textNodeId,
    sourceHandle: 'output',
    targetHandle: 'input'
  })
  
  // 选中文本节点
  canvasStore.selectNode(textNodeId)
}

// 触发上传
function triggerUpload() {
  fileInputRef.value?.click()
}

// 处理文件上传
async function handleFileUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  if (!file.type.startsWith('audio/')) {
    alert('请上传音频文件')
    return
  }
  
  try {
    const dataUrl = await readFileAsBase64(file)
    
    canvasStore.updateNodeData(props.id, {
      audioUrl: dataUrl,
      audioData: dataUrl,
      fileName: file.name,
      title: file.name,
      status: 'success',
      output: {
        type: 'audio',
        url: dataUrl
      }
    })
  } catch (error) {
    console.error('[AudioNode] 上传失败:', error)
  }
  
  // 清空文件选择
  event.target.value = ''
}

// 读取文件为 Base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 切换播放/暂停
function togglePlay() {
  if (!audioRef.value) return
  
  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
}

// 音频事件处理
function handleTimeUpdate() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

function handleLoadedMetadata() {
  if (audioRef.value) {
    duration.value = audioRef.value.duration
  }
}

function handlePlay() {
  isPlaying.value = true
}

function handlePause() {
  isPlaying.value = false
}

function handleEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

// 鼠标悬停自动播放
function handleMouseEnter() {
  if (!audioRef.value || !hasAudio.value) return
  audioRef.value.volume = volume.value
  audioRef.value.play().catch(() => {
    // 忽略自动播放被阻止的错误
  })
}

// 鼠标离开暂停播放
function handleMouseLeave() {
  if (!audioRef.value) return
  audioRef.value.pause()
}

// 滚轮调整音量
function handleWheel(event) {
  if (!audioRef.value || !hasAudio.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  // 向上滚动增加音量，向下滚动减少音量
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  const newVolume = Math.max(0, Math.min(1, volume.value + delta))
  
  volume.value = newVolume
  audioRef.value.volume = newVolume
  
  // 保存音量到节点数据
  canvasStore.updateNodeData(props.id, { volume: newVolume })
  
  // 显示音量指示器
  showVolumeIndicator.value = true
  if (volumeIndicatorTimer) {
    clearTimeout(volumeIndicatorTimer)
  }
  volumeIndicatorTimer = setTimeout(() => {
    showVolumeIndicator.value = false
  }, 1500)
}

// 点击进度条跳转
function handleProgressClick(event) {
  if (!audioRef.value || !duration.value) return
  
  const rect = event.currentTarget.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  audioRef.value.currentTime = percent * duration.value
}

// 拖拽上传
function handleDragEnter(e) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter.value++
  isDragOver.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragOver.value = false
  }
}

function handleDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

async function handleDrop(e) {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = false
  dragCounter.value = 0
  
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  if (!file.type.startsWith('audio/')) return
  
  try {
    const dataUrl = await readFileAsBase64(file)
    
    canvasStore.updateNodeData(props.id, {
      audioUrl: dataUrl,
      audioData: dataUrl,
      fileName: file.name,
      title: file.name,
      status: 'success',
      output: {
        type: 'audio',
        url: dataUrl
      }
    })
  } catch (error) {
    console.error('[AudioNode] 拖拽上传失败:', error)
  }
}

// 右键菜单
function handleContextMenu(event) {
  event.preventDefault()
  canvasStore.openContextMenu(
    { x: event.clientX, y: event.clientY },
    { id: props.id, type: 'audio-input', position: { x: 0, y: 0 }, data: props.data }
  )
}

// 左侧添加按钮
function handleAddLeftClick(event) {
  event.stopPropagation()
  canvasStore.openNodeSelector(
    { x: event.clientX, y: event.clientY },
    'node-left',
    props.id
  )
}

// ========== 右侧添加按钮交互（单击/长按） ==========
const LONG_PRESS_DURATION = 300
let pressTimer = null
let isLongPress = false
let pressStartPos = { x: 0, y: 0 }

function handleAddRightMouseDown(event) {
  event.stopPropagation()
  event.preventDefault()
  
  isLongPress = false
  pressStartPos = { x: event.clientX, y: event.clientY }
  
  pressTimer = setTimeout(() => {
    isLongPress = true
    startDragConnection(event)
  }, LONG_PRESS_DURATION)
  
  document.addEventListener('mousemove', handleAddRightMouseMove)
  document.addEventListener('mouseup', handleAddRightMouseUp)
}

function handleAddRightMouseMove(event) {
  const dx = event.clientX - pressStartPos.x
  const dy = event.clientY - pressStartPos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance > 5 && !isLongPress) {
    clearTimeout(pressTimer)
    isLongPress = true
    startDragConnection(event)
  }
}

function handleAddRightMouseUp(event) {
  clearTimeout(pressTimer)
  document.removeEventListener('mousemove', handleAddRightMouseMove)
  document.removeEventListener('mouseup', handleAddRightMouseUp)
  
  if (!isLongPress) {
    canvasStore.openNodeSelector(
      { x: event.clientX, y: event.clientY },
      'node',
      props.id
    )
  }
}

function startDragConnection(event) {
  const currentNode = canvasStore.nodes.find(n => n.id === props.id)
  if (!currentNode) return
  
  const currentNodeWidth = props.data?.width || nodeWidth.value || 420
  const currentNodeHeight = props.data?.height || nodeHeight.value || 280
  const labelOffset = 28
  
  const outputX = currentNode.position.x + currentNodeWidth
  const outputY = currentNode.position.y + labelOffset + currentNodeHeight / 2
  
  canvasStore.startDragConnection(props.id, 'output', { x: outputX, y: outputY })
}

// 开始调整尺寸
function handleResizeStart(handle, event) {
  event.stopPropagation()
  event.preventDefault()
  
  isResizing.value = true
  resizeHandle.value = handle
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: nodeWidth.value,
    height: nodeHeight.value
  }
  
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
}

function handleResizeMove(event) {
  if (!isResizing.value) return
  
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
  }
  
  const clientX = event.clientX
  const clientY = event.clientY
  
  resizeRafId = requestAnimationFrame(() => {
    if (!isResizing.value) return
    
    const deltaX = clientX - resizeStart.value.x
    const deltaY = clientY - resizeStart.value.y
    
    const viewport = canvasStore.viewport
    const zoom = viewport.zoom || 1
    
    if (resizeHandle.value === 'right' || resizeHandle.value === 'corner') {
      nodeWidth.value = Math.max(320, resizeStart.value.width + deltaX / zoom)
    }
    
    if (resizeHandle.value === 'bottom' || resizeHandle.value === 'corner') {
      nodeHeight.value = Math.max(200, resizeStart.value.height + deltaY / zoom)
    }
    
    // 实时更新连线位置
    updateNodeInternals(props.id)
    
    resizeRafId = null
  })
}

function handleResizeEnd() {
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
  
  isResizing.value = false
  resizeHandle.value = null
  
  canvasStore.updateNodeData(props.id, {
    width: nodeWidth.value,
    height: nodeHeight.value
  })
  
  // 更新节点内部状态，确保连线位置跟随 Handle 位置变化
  nextTick(() => {
    updateNodeInternals(props.id)
  })
  
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)
}

// 重置/更换音频
function handleReupload() {
  canvasStore.updateNodeData(props.id, {
    audioUrl: null,
    audioData: null,
    output: null,
    status: 'idle'
  })
}
</script>

<template>
  <div 
    :class="nodeClass" 
    @contextmenu="handleContextMenu"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- 左侧输入端口（隐藏但保留给 Vue Flow 用于边渲染） -->
    <Handle
      type="target"
      :position="Position.Left"
      id="input"
      class="node-handle node-handle-hidden"
    />
    
    <!-- 节点标签 -->
    <div 
      v-if="!isEditingLabel" 
      class="node-label"
      @dblclick="handleLabelDoubleClick"
      :title="'双击重命名'"
    >
      {{ localLabel }}
    </div>
    <input
      v-else
      ref="labelInputRef"
      v-model="localLabel"
      type="text"
      class="node-label-input"
      @blur="saveLabelEdit"
      @keydown="handleLabelKeyDown"
      @click.stop
      @mousedown.stop
    />
    
    <!-- 节点主体 -->
    <div class="node-wrapper">
      <!-- 左侧添加按钮 -->
      <button 
        class="node-add-btn node-add-btn-left"
        title="添加输入节点"
        @click="handleAddLeftClick"
      >
        +
      </button>
      
      <!-- 节点卡片 -->
      <div 
        class="node-card" 
        :class="{ 'drag-over': isDragOver }"
        :style="contentStyle"
      >
        <!-- 隐藏的文件上传 -->
        <input 
          ref="fileInputRef"
          type="file" 
          accept="audio/*"
          class="hidden-file-input"
          @change="handleFileUpload"
        />
        
        <!-- 有音频时显示播放器 -->
        <div 
          v-if="hasAudio" 
          class="audio-output-wrapper"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          @wheel.prevent="handleWheel"
        >
          <!-- 隐藏的 audio 元素 -->
          <audio 
            ref="audioRef"
            :src="audioUrl"
            @timeupdate="handleTimeUpdate"
            @loadedmetadata="handleLoadedMetadata"
            @play="handlePlay"
            @pause="handlePause"
            @ended="handleEnded"
          />
          
          <!-- 音量指示器 -->
          <div v-if="showVolumeIndicator" class="volume-indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path v-if="volume > 0.5" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              <path v-else-if="volume > 0" d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
              <path v-else d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
            <span class="volume-value">{{ Math.round(volume * 100) }}%</span>
          </div>
          
          <!-- 音频可视化区域 -->
          <div class="audio-visual">
            <div class="audio-wave">
              <span v-for="i in 7" :key="i" :class="{ active: isPlaying }"></span>
            </div>
          </div>
          
          <!-- 播放控制 -->
          <div class="audio-controls">
            <button class="play-btn" @click="togglePlay">
              <svg v-if="isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            
            <!-- 进度条 -->
            <div class="progress-bar" @click="handleProgressClick">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            
            <!-- 时间显示 -->
            <div class="time-display">
              {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
            </div>
          </div>
          
          <!-- 文件名 -->
          <div class="audio-title">{{ audioTitle }}</div>
          
        </div>
        
        <!-- 无音频时显示空状态 -->
        <div v-else class="node-content">
          <div class="empty-state">
            <div class="hint-text">尝试：</div>
            <div 
              v-for="action in quickActions"
              :key="action.label"
              class="quick-action"
              @click.stop="action.action"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
            </div>
          </div>
        </div>
        
        <!-- 拖拽覆盖层 -->
        <div v-if="isDragOver" class="drag-overlay">
          <div class="drag-hint">释放以上传音频</div>
        </div>
        
        <!-- Resize Handles -->
        <div 
          class="resize-handle resize-handle-right"
          @mousedown="handleResizeStart('right', $event)"
        ></div>
        <div 
          class="resize-handle resize-handle-bottom"
          @mousedown="handleResizeStart('bottom', $event)"
        ></div>
        <div 
          class="resize-handle resize-handle-corner"
          @mousedown="handleResizeStart('corner', $event)"
        ></div>
      </div>
      
      <!-- 右侧添加按钮 -->
      <button 
        class="node-add-btn node-add-btn-right"
        title="单击：添加节点 | 长按/拖拽：连接到其他节点"
        @mousedown="handleAddRightMouseDown"
      >
        +
      </button>
    </div>
    
    <!-- 底部配置面板（选中时显示） - 黑白现代风格 -->
    <div v-if="showConfigPanel" class="config-panel" @mousedown.stop>
      <!-- 音乐生成配置（无音频时显示） -->
      <div v-if="!hasAudio" class="music-gen-panel">
        <!-- 大文本输入区 -->
        <div class="prompt-area">
          <textarea
            v-model="musicPrompt"
            class="prompt-textarea"
            placeholder="描述您想要的音乐。"
            rows="4"
            @keydown="handleMusicKeyDown"
          ></textarea>
          <button class="expand-btn" title="展开">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
        </div>
        
        <!-- 控制栏 -->
        <div class="control-bar">
          <!-- 左侧：类型选择 -->
          <div class="type-selector">
            <span class="type-icon">♫</span>
            <span class="type-label">音乐</span>
            <span class="type-arrow">▾</span>
          </div>
          
          <!-- 模型选择器 -->
          <div class="model-selector" ref="musicModelSelectorRef" @click.stop>
            <div class="model-trigger" @click="toggleMusicModelDropdown">
              <span class="model-icon">∥</span>
              <span class="model-name">{{ currentMusicModelConfig?.label || selectedMusicModel }}</span>
              <span class="model-arrow" :class="{ 'rotate': isMusicModelDropdownOpen }">▾</span>
            </div>
            
            <!-- 模型下拉列表 -->
            <Transition name="dropdown-fade">
              <div v-if="isMusicModelDropdownOpen" class="model-dropdown-list" @wheel="handleDropdownWheel">
                <div
                  v-for="m in musicModels"
                  :key="m.value"
                  class="model-option"
                  :class="{ 'active': selectedMusicModel === m.value }"
                  @click="selectMusicModel(m.value)"
                >
                  <span class="option-name">{{ m.label }}</span>
                  <span v-if="m.description" class="option-desc">{{ m.description }}</span>
                </div>
              </div>
            </Transition>
          </div>
          
          <!-- 字数统计 -->
          <span class="char-count">{{ musicPrompt.length }}/4100</span>
          
          <!-- 积分显示 -->
          <div class="points-badge">
            <span class="points-icon">◎</span>
            <span class="points-value">{{ musicPointsCost }}积分</span>
          </div>
          
          <!-- 生成按钮 -->
          <button
            class="gen-btn"
            :disabled="isGeneratingMusic || !musicPrompt.trim()"
            @click="handleGenerateMusic"
          >
            <svg v-if="!isGeneratingMusic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            <span v-else class="loading-dots">···</span>
          </button>
        </div>
        
        <!-- 展开/收起按钮 -->
        <button class="collapse-trigger" @click="showAdvancedOptions = !showAdvancedOptions">
          <span class="collapse-icon" :class="{ 'expanded': showAdvancedOptions }">∧</span>
          <span>{{ showAdvancedOptions ? '收起' : '展开' }}</span>
        </button>
        
        <!-- 高级选项 -->
        <Transition name="slide-down">
          <div v-if="showAdvancedOptions" class="advanced-options">
            <!-- 纯音乐开关 -->
            <div class="option-row">
              <span class="option-label">纯音乐</span>
              <label class="toggle-switch">
                <input type="checkbox" v-model="makeInstrumental" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            
            <!-- 生成模式 -->
            <div class="option-row">
              <span class="option-label">生成模式</span>
              <div class="mode-tabs">
                <button :class="['mode-tab', { active: !customMode }]" @click="customMode = false">灵感</button>
                <button :class="['mode-tab', { active: customMode }]" @click="customMode = true">自定义</button>
              </div>
            </div>
            
            <!-- 歌名（仅自定义模式） -->
            <div v-if="customMode" class="option-row vertical">
              <span class="option-label">歌名</span>
              <input v-model="title" type="text" class="option-input" placeholder="输入歌名" />
            </div>
            
            <!-- 风格标签 -->
            <div class="option-row vertical">
              <span class="option-label">风格标签</span>
              <MusicTagsSelector v-model="tags" />
            </div>
            
            <!-- 排除标签 -->
            <div class="option-row vertical">
              <span class="option-label">排除标签</span>
              <input v-model="negativeTags" type="text" class="option-input" placeholder="逗号分隔" />
            </div>
          </div>
        </Transition>
      </div>
      
      <!-- 有音频时的面板 -->
      <div v-else class="audio-info-panel">
        <div class="info-header">
          <span class="info-title">{{ audioTitle }}</span>
          <button class="reupload-btn" @click.stop="handleReupload">重新生成</button>
        </div>
        <div class="quick-actions-row">
          <button class="action-chip" @click.stop="handleLipSync">
            <span>◐</span> 对口型
          </button>
          <button class="action-chip" @click.stop="handleAudioToVideo">
            <span>▶</span> 生视频
          </button>
          <button class="action-chip" @click.stop="handleAudioToText">
            <span>✎</span> 提文案
          </button>
        </div>
      </div>
    </div>
    
    <!-- 右侧输出端口（隐藏但保留给 Vue Flow 用于边渲染） -->
    <Handle
      type="source"
      :position="Position.Right"
      id="output"
      class="node-handle node-handle-hidden"
    />
  </div>
</template>

<style scoped>
.audio-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: visible;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 节点标签 */
.node-label {
  color: var(--canvas-text-secondary, #a0a0a0);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  text-align: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  user-select: none;
}

.node-label:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--canvas-text-primary, #ffffff);
}

/* 标签编辑输入框 */
.node-label-input {
  color: var(--canvas-text-primary, #ffffff);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  text-align: center;
  background: var(--canvas-bg-tertiary, #1a1a1a);
  border: 1px solid var(--canvas-accent-audio, #a855f7);
  border-radius: 4px;
  padding: 4px 8px;
  outline: none;
  min-width: 60px;
  max-width: 200px;
}

/* 节点包装器 */
.node-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

/* 节点卡片 */
.node-card {
  background: var(--canvas-bg-tertiary, #1a1a1a);
  border: 1px solid var(--canvas-border-subtle, #2a2a2a);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.audio-node:hover .node-card {
  border-color: var(--canvas-border-active, #4a4a4a);
}

.audio-node.selected .node-card {
  border-color: var(--canvas-accent-audio, #a855f7);
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
}

.node-card.drag-over {
  border-color: var(--canvas-accent-audio, #a855f7);
  background: rgba(168, 85, 247, 0.1);
}

/* 有输出时 - 无边框设计 */
.audio-node.has-output .node-card {
  background: transparent;
  border: none;
  overflow: visible;
  padding: 0;
  min-height: auto !important;
  height: auto !important;
}

.audio-node.has-output.selected .node-card {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* 主内容区域 */
.node-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

/* 空状态（与 VideoNode 统一） */
.empty-state {
  flex: 1;
  padding: 20px;
}

.hint-text {
  color: var(--canvas-text-tertiary, #666666);
  font-size: 13px;
  margin-bottom: 16px;
}

.quick-action {
  display: flex;
  align-items: center;
  padding: 12px 8px;
  color: var(--canvas-text-secondary, #a0a0a0);
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.quick-action:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--canvas-text-primary, #ffffff);
}

.action-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
  margin-right: 8px;
}

.action-label {
  flex: 1;
}

/* ========== 音频输出预览 ========== */
.audio-output-wrapper {
  position: relative;
  width: 100%;
  padding: 20px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(28, 28, 32, 0.98) 0%, rgba(20, 20, 24, 0.98) 100%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: box-shadow 0.2s ease;
}

.audio-node.selected .audio-output-wrapper {
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.4),
    0 0 0 2px var(--canvas-accent-audio, #a855f7),
    0 0 20px rgba(168, 85, 247, 0.3);
}

/* 音量指示器 */
.volume-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  z-index: 100;
  pointer-events: none;
  animation: fadeIn 0.15s ease;
}

.volume-indicator svg {
  opacity: 0.9;
}

.volume-value {
  min-width: 36px;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* 音频可视化 */
.audio-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  background: rgba(168, 85, 247, 0.1);
  border-radius: 10px;
  margin-bottom: 16px;
}

.audio-wave {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 50px;
}

.audio-wave span {
  width: 5px;
  background: linear-gradient(180deg, #a855f7 0%, #d8b4fe 100%);
  border-radius: 3px;
  transition: height 0.2s;
}

.audio-wave span:nth-child(1) { height: 18px; }
.audio-wave span:nth-child(2) { height: 28px; }
.audio-wave span:nth-child(3) { height: 40px; }
.audio-wave span:nth-child(4) { height: 50px; }
.audio-wave span:nth-child(5) { height: 40px; }
.audio-wave span:nth-child(6) { height: 28px; }
.audio-wave span:nth-child(7) { height: 18px; }

.audio-wave span.active {
  animation: wave 0.5s ease-in-out infinite;
}

.audio-wave span:nth-child(1).active { animation-delay: 0s; }
.audio-wave span:nth-child(2).active { animation-delay: 0.08s; }
.audio-wave span:nth-child(3).active { animation-delay: 0.16s; }
.audio-wave span:nth-child(4).active { animation-delay: 0.24s; }
.audio-wave span:nth-child(5).active { animation-delay: 0.32s; }
.audio-wave span:nth-child(6).active { animation-delay: 0.4s; }
.audio-wave span:nth-child(7).active { animation-delay: 0.48s; }

@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.4); }
}

/* 播放控制 */
.audio-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.play-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.play-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.5);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #a855f7, #d8b4fe);
  border-radius: 4px;
  transition: width 0.1s;
}

.time-display {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 80px;
  text-align: right;
  flex-shrink: 0;
}

/* 标题 */
.audio-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* 拖拽覆盖层 */
.drag-overlay {
  position: absolute;
  inset: 0;
  background: rgba(168, 85, 247, 0.2);
  backdrop-filter: blur(2px);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 100;
}

.drag-hint {
  padding: 12px 24px;
  background: rgba(168, 85, 247, 0.9);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

/* 端口样式 - 位置与+按钮对齐（但视觉隐藏） */
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

/* 调整 Handle 位置与 + 按钮中心对齐 */
:deep(.vue-flow__handle.target) {
  left: -39px !important;
  top: calc(50% + 14px) !important;
  transform: translateY(-50%) !important;
}

:deep(.vue-flow__handle.source) {
  right: -39px !important;
  top: calc(50% + 14px) !important;
  transform: translateY(-50%) !important;
}

/* 添加按钮 */
.node-add-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  font-weight: 300;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;
}

.node-wrapper:hover .node-add-btn,
.audio-node.selected .node-add-btn {
  opacity: 1;
}

.node-add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.9);
  transform: translateY(-50%) scale(1.1);
}

.node-add-btn-left {
  left: -52px;
}

.node-add-btn-right {
  right: -52px;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 20;
}

.node-card:hover .resize-handle {
  opacity: 1;
}

.resize-handle-right {
  right: -2px;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
}

.resize-handle-right:hover {
  background: var(--canvas-accent-audio, #a855f7);
}

.resize-handle-bottom {
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 4px;
  cursor: ns-resize;
}

.resize-handle-bottom:hover {
  background: var(--canvas-accent-audio, #a855f7);
}

.resize-handle-corner {
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
  background: var(--canvas-accent-audio, #a855f7);
  border-radius: 2px;
}

/* 隐藏的文件输入 */
.hidden-file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  opacity: 0;
  overflow: hidden;
  z-index: -1;
}

/* ========== 底部配置面板 - 黑白现代风格 ========== */
.config-panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: 520px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 1000;
  pointer-events: auto;
}

/* ===== 音乐生成面板 ===== */
.music-gen-panel {
  display: flex;
  flex-direction: column;
}

/* 提示词输入区域 */
.prompt-area {
  position: relative;
  padding: 20px 20px 16px;
}

.prompt-textarea {
  width: 100%;
  min-height: 100px;
  padding: 0;
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 15px;
  font-family: inherit;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.prompt-textarea::placeholder {
  color: #666666;
}

.expand-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: #666666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.expand-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

/* 控制栏 */
.control-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #141414;
  border-top: 1px solid #252525;
}

/* 类型选择器 */
.type-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #252525;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.type-selector:hover {
  background: #2a2a2a;
}

.type-icon {
  font-size: 16px;
  color: #888888;
}

.type-label {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.type-arrow {
  font-size: 10px;
  color: #666666;
}

/* 模型选择器 */
.model-selector {
  position: relative;
  flex: 1;
  min-width: 0;
}

.model-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #252525;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.model-trigger:hover {
  background: #2a2a2a;
}

.model-icon {
  font-size: 14px;
  color: #888888;
}

.model-name {
  flex: 1;
  font-size: 14px;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-arrow {
  font-size: 10px;
  color: #666666;
  transition: transform 0.2s;
}

.model-arrow.rotate {
  transform: rotate(180deg);
}

/* 模型下拉列表 */
.model-dropdown-list {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #1e1e1e;
  border: 1px solid #333333;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  z-index: 300;
  max-height: 300px;
  overflow-y: auto;
}

.model-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.model-option:hover {
  background: #2a2a2a;
}

.model-option.active {
  background: #333333;
}

.option-name {
  font-size: 14px;
  color: #ffffff;
}

.option-desc {
  font-size: 12px;
  color: #888888;
}

/* 字数统计 */
.char-count {
  font-size: 13px;
  color: #666666;
  white-space: nowrap;
}

/* 积分徽章 */
.points-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #252525;
  border-radius: 20px;
}

.points-icon {
  font-size: 14px;
  color: #888888;
}

.points-value {
  font-size: 13px;
  color: #ffffff;
  white-space: nowrap;
}

/* 生成按钮 */
.gen-btn {
  width: 40px;
  height: 40px;
  background: #ffffff;
  border: none;
  border-radius: 50%;
  color: #000000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.gen-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
}

.gen-btn:disabled {
  background: #333333;
  color: #666666;
  cursor: not-allowed;
}

.loading-dots {
  font-size: 16px;
  font-weight: bold;
}

/* 展开/收起按钮 */
.collapse-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  border-top: 1px solid #252525;
  color: #888888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-trigger:hover {
  background: rgba(255, 255, 255, 0.02);
  color: #ffffff;
}

.collapse-icon {
  font-size: 12px;
  transition: transform 0.2s;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

/* 高级选项 */
.advanced-options {
  padding: 16px 20px 20px;
  border-top: 1px solid #252525;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-row.vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.option-label {
  font-size: 14px;
  color: #888888;
}

.option-input {
  width: 100%;
  padding: 10px 12px;
  background: #252525;
  border: 1px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.option-input:focus {
  border-color: #555555;
}

.option-input::placeholder {
  color: #555555;
}

/* 开关 */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #333333;
  border-radius: 24px;
  transition: background 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: #888888;
  border-radius: 50%;
  transition: all 0.2s;
}

.toggle-switch input:checked + .toggle-slider {
  background: #ffffff;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: #000000;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  gap: 4px;
  background: #252525;
  padding: 4px;
  border-radius: 8px;
}

.mode-tab {
  padding: 6px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #888888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab:hover {
  color: #ffffff;
}

.mode-tab.active {
  background: #333333;
  color: #ffffff;
}

/* ===== 有音频时的信息面板 ===== */
.audio-info-panel {
  padding: 16px 20px;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.info-title {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 12px;
}

.reupload-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #333333;
  border-radius: 6px;
  color: #888888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.reupload-btn:hover {
  border-color: #555555;
  color: #ffffff;
}

.quick-actions-row {
  display: flex;
  gap: 8px;
}

.action-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #252525;
  border: none;
  border-radius: 20px;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-chip:hover {
  background: #333333;
  color: #ffffff;
}

.action-chip span:first-child {
  font-size: 14px;
}

/* 下拉动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  transform-origin: top;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0.9);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: scaleY(1);
}

/* 模型下拉框淡入动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 滚动条样式 */
.model-dropdown-list::-webkit-scrollbar {
  width: 6px;
}

.model-dropdown-list::-webkit-scrollbar-track {
  background: transparent;
}

.model-dropdown-list::-webkit-scrollbar-thumb {
  background: #444444;
  border-radius: 3px;
}

.advanced-options::-webkit-scrollbar {
  width: 6px;
}

.advanced-options::-webkit-scrollbar-track {
  background: transparent;
}

.advanced-options::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 3px;
}
</style>
