<script setup>
/**
 * NativeImageEditor.vue - 基于原生 Canvas API 的全功能图片编辑器
 * 
 * 功能特性:
 * - 裁剪 (Crop) - 支持自由裁剪和预设比例
 * - 翻转/旋转 (Flip/Rotate)
 * - 画笔绘图 (Draw)
 * - 形状工具 (Shape - 矩形、圆形、箭头)
 * - 文字工具 (Text)
 * - 滤镜效果 (Filter - 灰度、反色、模糊等)
 * - 调整工具 (Adjust - 亮度、对比度、饱和度)
 * - 撤销/重做
 * - 蒙版绘制 (用于 AI Inpainting)
 * 
 * 零外部依赖，纯原生实现
 */
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  },
  initialTool: {
    type: String,
    default: ''
  },
  width: {
    type: Number,
    default: 1000
  },
  height: {
    type: Number,
    default: 700
  }
})

const emit = defineEmits(['save', 'cancel'])

// DOM 引用
const containerRef = ref(null)
const mainCanvasRef = ref(null)
const overlayCanvasRef = ref(null)

// 状态
const isLoading = ref(true)
const currentMode = ref('')
const mainCtx = ref(null)
const overlayCtx = ref(null)

// 原始图片
const originalImage = new Image()
originalImage.crossOrigin = 'anonymous'

// 画布尺寸
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// 历史记录
const history = ref([])
const historyIndex = ref(-1)
const maxHistory = 30

// 绘图状态
const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)

// 工具设置
const brushSize = ref(10)
const brushColor = ref('#FF0000')
const fontSize = ref(24)
const fontFamily = ref('Arial')
const textContent = ref('')
const selectedShape = ref('rect')
const strokeWidth = ref(3)

// 滤镜设置
const filters = ref({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  invert: 0,
  sepia: 0
})

// 裁剪状态
const cropRect = ref({ x: 0, y: 0, width: 0, height: 0 })
const isCropping = ref(false)
const cropAspectRatio = ref('free')

// 旋转状态
const rotation = ref(0)
const flipX = ref(false)
const flipY = ref(false)

// 形状绘制状态
const shapeStart = ref({ x: 0, y: 0 })
const isDrawingShape = ref(false)

// 文字输入状态
const textPosition = ref({ x: 0, y: 0 })
const showTextInput = ref(false)

// 颜色预设
const colorPresets = [
  '#FF0000', '#FF6B00', '#FFD700', '#00FF00', 
  '#00BFFF', '#0000FF', '#8B00FF', '#FF1493',
  '#FFFFFF', '#808080', '#000000'
]

// 裁剪比例预设
const cropRatios = [
  { value: 'free', label: '自由' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' }
]

// 形状选项
const shapeOptions = [
  { value: 'rect', label: '矩形', icon: '⬜' },
  { value: 'circle', label: '圆形', icon: '⭕' },
  { value: 'arrow', label: '箭头', icon: '➡️' },
  { value: 'line', label: '直线', icon: '📏' }
]

// 计算当前滤镜 CSS
const filterStyle = computed(() => {
  return `
    brightness(${filters.value.brightness}%)
    contrast(${filters.value.contrast}%)
    saturate(${filters.value.saturation}%)
    blur(${filters.value.blur}px)
    grayscale(${filters.value.grayscale}%)
    invert(${filters.value.invert}%)
    sepia(${filters.value.sepia}%)
  `
})

// 初始化
async function init() {
  isLoading.value = true
  
  try {
    await loadImage(props.imageUrl)
    setupCanvas()
    drawImage()
    saveToHistory()
    isLoading.value = false
    
    if (props.initialTool) {
      activateMode(props.initialTool)
    }
  } catch (error) {
    console.error('[NativeImageEditor] 初始化失败:', error)
    isLoading.value = false
  }
}

// 加载图片
function loadImage(url) {
  return new Promise((resolve, reject) => {
    originalImage.onload = () => {
      // 计算适合的画布尺寸
      const maxWidth = props.width - 40
      const maxHeight = props.height - 200
      
      let w = originalImage.width
      let h = originalImage.height
      
      if (w > maxWidth) {
        h = h * (maxWidth / w)
        w = maxWidth
      }
      if (h > maxHeight) {
        w = w * (maxHeight / h)
        h = maxHeight
      }
      
      canvasWidth.value = Math.round(w)
      canvasHeight.value = Math.round(h)
      
      resolve()
    }
    originalImage.onerror = reject
    originalImage.src = url
  })
}

// 设置画布
function setupCanvas() {
  nextTick(() => {
    if (mainCanvasRef.value) {
      mainCtx.value = mainCanvasRef.value.getContext('2d')
    }
    if (overlayCanvasRef.value) {
      overlayCtx.value = overlayCanvasRef.value.getContext('2d')
    }
  })
}

// 绘制图片到主画布
function drawImage() {
  if (!mainCtx.value) return
  
  const ctx = mainCtx.value
  const canvas = mainCanvasRef.value
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  
  // 应用变换
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation.value * Math.PI) / 180)
  ctx.scale(flipX.value ? -1 : 1, flipY.value ? -1 : 1)
  ctx.translate(-canvas.width / 2, -canvas.height / 2)
  
  // 应用滤镜
  ctx.filter = filterStyle.value
  
  // 绘制图片
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height)
  
  ctx.restore()
}

// 保存到历史记录
function saveToHistory() {
  if (!mainCanvasRef.value) return
  
  // 删除当前位置之后的历史
  history.value = history.value.slice(0, historyIndex.value + 1)
  
  // 保存当前状态
  const imageData = mainCanvasRef.value.toDataURL('image/png')
  history.value.push({
    imageData,
    filters: { ...filters.value },
    rotation: rotation.value,
    flipX: flipX.value,
    flipY: flipY.value
  })
  
  // 限制历史记录数量
  if (history.value.length > maxHistory) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

// 撤销
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    restoreFromHistory()
  }
}

// 重做
function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    restoreFromHistory()
  }
}

// 从历史记录恢复
function restoreFromHistory() {
  const state = history.value[historyIndex.value]
  if (!state) return
  
  const img = new Image()
  img.onload = () => {
    mainCtx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
    mainCtx.value.drawImage(img, 0, 0)
  }
  img.src = state.imageData
  
  filters.value = { ...state.filters }
  rotation.value = state.rotation
  flipX.value = state.flipX
  flipY.value = state.flipY
}

// 激活模式
function activateMode(mode) {
  // 如果切换模式，先应用当前操作
  if (currentMode.value === 'crop' && isCropping.value) {
    cancelCrop()
  }
  
  currentMode.value = mode
  clearOverlay()
  
  if (mode === 'crop') {
    initCrop()
  }
}

// 退出当前模式
function exitMode() {
  currentMode.value = ''
  clearOverlay()
}

// 清除覆盖层
function clearOverlay() {
  if (overlayCtx.value) {
    overlayCtx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  }
}

// ==================== 绘图工具 ====================

function startDraw(e) {
  if (currentMode.value !== 'draw' && currentMode.value !== 'mask') return
  
  isDrawing.value = true
  const rect = mainCanvasRef.value.getBoundingClientRect()
  lastX.value = e.clientX - rect.left
  lastY.value = e.clientY - rect.top
}

function draw(e) {
  if (!isDrawing.value) return
  if (currentMode.value !== 'draw' && currentMode.value !== 'mask') return
  
  const rect = mainCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const ctx = mainCtx.value
  ctx.beginPath()
  ctx.moveTo(lastX.value, lastY.value)
  ctx.lineTo(x, y)
  ctx.strokeStyle = currentMode.value === 'mask' ? 'rgba(255, 0, 0, 0.5)' : brushColor.value
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  
  lastX.value = x
  lastY.value = y
}

function endDraw() {
  if (isDrawing.value) {
    isDrawing.value = false
    saveToHistory()
  }
}

// ==================== 形状工具 ====================

function startShape(e) {
  if (currentMode.value !== 'shape') return
  
  isDrawingShape.value = true
  const rect = mainCanvasRef.value.getBoundingClientRect()
  shapeStart.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

function drawShapePreview(e) {
  if (!isDrawingShape.value || currentMode.value !== 'shape') return
  
  const rect = mainCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  clearOverlay()
  const ctx = overlayCtx.value
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = strokeWidth.value
  ctx.fillStyle = 'transparent'
  
  const startX = shapeStart.value.x
  const startY = shapeStart.value.y
  const width = x - startX
  const height = y - startY
  
  ctx.beginPath()
  
  switch (selectedShape.value) {
    case 'rect':
      ctx.strokeRect(startX, startY, width, height)
      break
    case 'circle':
      const radius = Math.sqrt(width * width + height * height) / 2
      const centerX = startX + width / 2
      const centerY = startY + height / 2
      ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'line':
      ctx.moveTo(startX, startY)
      ctx.lineTo(x, y)
      ctx.stroke()
      break
    case 'arrow':
      drawArrow(ctx, startX, startY, x, y)
      break
  }
}

function endShape(e) {
  if (!isDrawingShape.value || currentMode.value !== 'shape') return
  
  const rect = mainCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const ctx = mainCtx.value
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = strokeWidth.value
  
  const startX = shapeStart.value.x
  const startY = shapeStart.value.y
  const width = x - startX
  const height = y - startY
  
  ctx.beginPath()
  
  switch (selectedShape.value) {
    case 'rect':
      ctx.strokeRect(startX, startY, width, height)
      break
    case 'circle':
      const radius = Math.sqrt(width * width + height * height) / 2
      const centerX = startX + width / 2
      const centerY = startY + height / 2
      ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'line':
      ctx.moveTo(startX, startY)
      ctx.lineTo(x, y)
      ctx.stroke()
      break
    case 'arrow':
      drawArrow(ctx, startX, startY, x, y)
      break
  }
  
  isDrawingShape.value = false
  clearOverlay()
  saveToHistory()
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 15
  const angle = Math.atan2(toY - fromY, toX - fromX)
  
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

// ==================== 文字工具 ====================

function handleTextClick(e) {
  if (currentMode.value !== 'text') return
  
  const rect = mainCanvasRef.value.getBoundingClientRect()
  textPosition.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  showTextInput.value = true
  textContent.value = ''
  
  nextTick(() => {
    const input = document.querySelector('.text-input-overlay input')
    if (input) input.focus()
  })
}

function addText() {
  if (!textContent.value.trim()) {
    showTextInput.value = false
    return
  }
  
  const ctx = mainCtx.value
  ctx.font = `${fontSize.value}px ${fontFamily.value}`
  ctx.fillStyle = brushColor.value
  ctx.fillText(textContent.value, textPosition.value.x, textPosition.value.y)
  
  showTextInput.value = false
  textContent.value = ''
  saveToHistory()
}

function cancelText() {
  showTextInput.value = false
  textContent.value = ''
}

// ==================== 裁剪工具 ====================

function initCrop() {
  isCropping.value = true
  // 初始裁剪框为图片中心 80%
  const margin = 0.1
  cropRect.value = {
    x: canvasWidth.value * margin,
    y: canvasHeight.value * margin,
    width: canvasWidth.value * (1 - margin * 2),
    height: canvasHeight.value * (1 - margin * 2)
  }
  drawCropOverlay()
}

function drawCropOverlay() {
  if (!overlayCtx.value) return
  
  const ctx = overlayCtx.value
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 清除裁剪区域
  const { x, y, width, height } = cropRect.value
  ctx.clearRect(x, y, width, height)
  
  // 裁剪框边框
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
  
  // 网格线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 1
  
  // 垂直线
  ctx.beginPath()
  ctx.moveTo(x + width / 3, y)
  ctx.lineTo(x + width / 3, y + height)
  ctx.moveTo(x + width * 2 / 3, y)
  ctx.lineTo(x + width * 2 / 3, y + height)
  // 水平线
  ctx.moveTo(x, y + height / 3)
  ctx.lineTo(x + width, y + height / 3)
  ctx.moveTo(x, y + height * 2 / 3)
  ctx.lineTo(x + width, y + height * 2 / 3)
  ctx.stroke()
  
  // 角落控制点
  const cornerSize = 10
  ctx.fillStyle = '#fff'
  // 左上
  ctx.fillRect(x - cornerSize / 2, y - cornerSize / 2, cornerSize, cornerSize)
  // 右上
  ctx.fillRect(x + width - cornerSize / 2, y - cornerSize / 2, cornerSize, cornerSize)
  // 左下
  ctx.fillRect(x - cornerSize / 2, y + height - cornerSize / 2, cornerSize, cornerSize)
  // 右下
  ctx.fillRect(x + width - cornerSize / 2, y + height - cornerSize / 2, cornerSize, cornerSize)
}

let cropDragType = null
let cropStartPos = { x: 0, y: 0 }
let cropStartRect = { x: 0, y: 0, width: 0, height: 0 }

function startCropDrag(e) {
  if (!isCropping.value) return
  
  const rect = overlayCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const { x: cx, y: cy, width: cw, height: ch } = cropRect.value
  const cornerSize = 15
  
  // 检测拖拽类型
  if (Math.abs(x - cx) < cornerSize && Math.abs(y - cy) < cornerSize) {
    cropDragType = 'nw'
  } else if (Math.abs(x - (cx + cw)) < cornerSize && Math.abs(y - cy) < cornerSize) {
    cropDragType = 'ne'
  } else if (Math.abs(x - cx) < cornerSize && Math.abs(y - (cy + ch)) < cornerSize) {
    cropDragType = 'sw'
  } else if (Math.abs(x - (cx + cw)) < cornerSize && Math.abs(y - (cy + ch)) < cornerSize) {
    cropDragType = 'se'
  } else if (x > cx && x < cx + cw && y > cy && y < cy + ch) {
    cropDragType = 'move'
  } else {
    cropDragType = null
    return
  }
  
  cropStartPos = { x, y }
  cropStartRect = { ...cropRect.value }
}

function moveCropDrag(e) {
  if (!cropDragType) return
  
  const rect = overlayCanvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const dx = x - cropStartPos.x
  const dy = y - cropStartPos.y
  
  const newRect = { ...cropStartRect }
  
  switch (cropDragType) {
    case 'nw':
      newRect.x = Math.max(0, cropStartRect.x + dx)
      newRect.y = Math.max(0, cropStartRect.y + dy)
      newRect.width = cropStartRect.width - dx
      newRect.height = cropStartRect.height - dy
      break
    case 'ne':
      newRect.y = Math.max(0, cropStartRect.y + dy)
      newRect.width = cropStartRect.width + dx
      newRect.height = cropStartRect.height - dy
      break
    case 'sw':
      newRect.x = Math.max(0, cropStartRect.x + dx)
      newRect.width = cropStartRect.width - dx
      newRect.height = cropStartRect.height + dy
      break
    case 'se':
      newRect.width = cropStartRect.width + dx
      newRect.height = cropStartRect.height + dy
      break
    case 'move':
      newRect.x = Math.max(0, Math.min(canvasWidth.value - cropStartRect.width, cropStartRect.x + dx))
      newRect.y = Math.max(0, Math.min(canvasHeight.value - cropStartRect.height, cropStartRect.y + dy))
      break
  }
  
  // 确保最小尺寸
  if (newRect.width >= 50 && newRect.height >= 50) {
    // 限制边界
    newRect.width = Math.min(newRect.width, canvasWidth.value - newRect.x)
    newRect.height = Math.min(newRect.height, canvasHeight.value - newRect.y)
    
    // 应用比例约束
    if (cropAspectRatio.value !== 'free') {
      const [w, h] = cropAspectRatio.value.split(':').map(Number)
      const ratio = w / h
      
      if (cropDragType.includes('e') || cropDragType.includes('w')) {
        newRect.height = newRect.width / ratio
      } else {
        newRect.width = newRect.height * ratio
      }
    }
    
    cropRect.value = newRect
    drawCropOverlay()
  }
}

function endCropDrag() {
  cropDragType = null
}

function applyCrop() {
  if (!isCropping.value) return
  
  const { x, y, width, height } = cropRect.value
  
  // 创建临时画布
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')
  
  // 裁剪图片
  tempCtx.drawImage(mainCanvasRef.value, x, y, width, height, 0, 0, width, height)
  
  // 更新画布尺寸
  canvasWidth.value = width
  canvasHeight.value = height
  
  nextTick(() => {
    // 绘制裁剪后的图片
    mainCtx.value.clearRect(0, 0, width, height)
    mainCtx.value.drawImage(tempCanvas, 0, 0)
    
    // 更新原始图片
    const img = new Image()
    img.onload = () => {
      originalImage.src = tempCanvas.toDataURL('image/png')
    }
    img.src = tempCanvas.toDataURL('image/png')
    
    isCropping.value = false
    currentMode.value = ''
    clearOverlay()
    saveToHistory()
  })
}

function cancelCrop() {
  isCropping.value = false
  clearOverlay()
}

// ==================== 翻转/旋转 ====================

function flipHorizontal() {
  flipX.value = !flipX.value
  drawImage()
  saveToHistory()
}

function flipVertical() {
  flipY.value = !flipY.value
  drawImage()
  saveToHistory()
}

function rotateLeft() {
  rotation.value = (rotation.value - 90) % 360
  drawImage()
  saveToHistory()
}

function rotateRight() {
  rotation.value = (rotation.value + 90) % 360
  drawImage()
  saveToHistory()
}

// ==================== 滤镜 ====================

function applyFilters() {
  drawImage()
  saveToHistory()
}

function resetFilters() {
  filters.value = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    invert: 0,
    sepia: 0
  }
  drawImage()
  saveToHistory()
}

// ==================== 重置 ====================

function resetAll() {
  rotation.value = 0
  flipX.value = false
  flipY.value = false
  resetFilters()
  
  loadImage(props.imageUrl).then(() => {
    drawImage()
    history.value = []
    historyIndex.value = -1
    saveToHistory()
  })
}

// ==================== 保存/取消 ====================

function save() {
  const dataUrl = mainCanvasRef.value.toDataURL('image/png')
  emit('save', {
    image: dataUrl,
    hasMask: currentMode.value === 'mask'
  })
}

function cancel() {
  emit('cancel')
}

// ==================== 事件处理 ====================

function handleMouseDown(e) {
  if (currentMode.value === 'draw' || currentMode.value === 'mask') {
    startDraw(e)
  } else if (currentMode.value === 'shape') {
    startShape(e)
  } else if (currentMode.value === 'crop') {
    startCropDrag(e)
  }
}

function handleMouseMove(e) {
  if (currentMode.value === 'draw' || currentMode.value === 'mask') {
    draw(e)
  } else if (currentMode.value === 'shape') {
    drawShapePreview(e)
  } else if (currentMode.value === 'crop') {
    moveCropDrag(e)
  }
}

function handleMouseUp(e) {
  if (currentMode.value === 'draw' || currentMode.value === 'mask') {
    endDraw()
  } else if (currentMode.value === 'shape') {
    endShape(e)
  } else if (currentMode.value === 'crop') {
    endCropDrag()
  }
}

function handleClick(e) {
  if (currentMode.value === 'text') {
    handleTextClick(e)
  }
}

// 生命周期
onMounted(() => {
  init()
  
  // 添加全局事件监听
  window.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
})

// 监听图片URL变化
watch(() => props.imageUrl, (newUrl) => {
  if (newUrl) {
    init()
  }
})
</script>

<template>
  <div class="native-editor-wrapper" ref="containerRef">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <!-- 主工具 -->
      <div class="toolbar-section">
        <div class="toolbar-group">
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'crop' }"
            @click="activateMode('crop')"
            title="裁剪"
          >
            <span class="tool-icon">✂️</span>
            <span class="tool-label">裁剪</span>
          </button>
          
          <button class="tool-btn" @click="flipHorizontal" title="水平翻转">
            <span class="tool-icon">↔️</span>
            <span class="tool-label">水平翻转</span>
          </button>
          
          <button class="tool-btn" @click="flipVertical" title="垂直翻转">
            <span class="tool-icon">↕️</span>
            <span class="tool-label">垂直翻转</span>
          </button>
          
          <button class="tool-btn" @click="rotateLeft" title="左旋转90°">
            <span class="tool-icon">↩️</span>
            <span class="tool-label">左旋</span>
          </button>
          
          <button class="tool-btn" @click="rotateRight" title="右旋转90°">
            <span class="tool-icon">↪️</span>
            <span class="tool-label">右旋</span>
          </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'draw' }"
            @click="activateMode('draw')"
            title="画笔"
          >
            <span class="tool-icon">🖌️</span>
            <span class="tool-label">画笔</span>
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'shape' }"
            @click="activateMode('shape')"
            title="形状"
          >
            <span class="tool-icon">⬜</span>
            <span class="tool-label">形状</span>
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'text' }"
            @click="activateMode('text')"
            title="文字"
          >
            <span class="tool-icon">📝</span>
            <span class="tool-label">文字</span>
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'mask' }"
            @click="activateMode('mask')"
            title="蒙版（用于AI重绘）"
          >
            <span class="tool-icon">🎭</span>
            <span class="tool-label">蒙版</span>
          </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
          <button 
            class="tool-btn" 
            :class="{ active: currentMode === 'filter' }"
            @click="activateMode('filter')"
            title="滤镜调整"
          >
            <span class="tool-icon">🎨</span>
            <span class="tool-label">滤镜</span>
          </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
          <button class="tool-btn" @click="undo" :disabled="historyIndex <= 0" title="撤销">
            <span class="tool-icon">↩</span>
            <span class="tool-label">撤销</span>
          </button>
          
          <button class="tool-btn" @click="redo" :disabled="historyIndex >= history.length - 1" title="重做">
            <span class="tool-icon">↪</span>
            <span class="tool-label">重做</span>
          </button>
          
          <button class="tool-btn danger" @click="resetAll" title="重置">
            <span class="tool-icon">🔄</span>
            <span class="tool-label">重置</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 子工具栏 -->
    <div v-if="currentMode" class="sub-toolbar">
      <!-- 裁剪选项 -->
      <template v-if="currentMode === 'crop'">
        <div class="sub-control">
          <label>比例</label>
          <div class="ratio-btns">
            <button 
              v-for="ratio in cropRatios" 
              :key="ratio.value"
              class="ratio-btn"
              :class="{ active: cropAspectRatio === ratio.value }"
              @click="cropAspectRatio = ratio.value"
            >
              {{ ratio.label }}
            </button>
          </div>
        </div>
        <button class="sub-btn primary" @click="applyCrop">
          <span>✓</span> 应用裁剪
        </button>
        <button class="sub-btn" @click="cancelCrop">
          取消
        </button>
      </template>
      
      <!-- 画笔/蒙版设置 -->
      <template v-if="['draw', 'mask'].includes(currentMode)">
        <div class="sub-control">
          <label>粗细</label>
          <input 
            type="range" 
            v-model.number="brushSize" 
            min="1" 
            max="100" 
            class="slider"
          />
          <span class="value">{{ brushSize }}px</span>
        </div>
        
        <div v-if="currentMode === 'draw'" class="sub-control colors">
          <label>颜色</label>
          <div class="color-presets">
            <button 
              v-for="color in colorPresets" 
              :key="color"
              class="color-btn"
              :class="{ active: brushColor === color }"
              :style="{ backgroundColor: color }"
              @click="brushColor = color"
            ></button>
          </div>
          <input 
            type="color" 
            v-model="brushColor" 
            class="color-picker"
          />
        </div>
        
        <div v-if="currentMode === 'mask'" class="mask-hint">
          💡 涂抹区域将用于 AI 重绘
        </div>
      </template>
      
      <!-- 形状设置 -->
      <template v-if="currentMode === 'shape'">
        <div class="sub-control">
          <label>形状</label>
          <div class="shape-btns">
            <button 
              v-for="shape in shapeOptions" 
              :key="shape.value"
              class="shape-btn"
              :class="{ active: selectedShape === shape.value }"
              @click="selectedShape = shape.value"
              :title="shape.label"
            >
              {{ shape.icon }}
            </button>
          </div>
        </div>
        
        <div class="sub-control">
          <label>粗细</label>
          <input 
            type="range" 
            v-model.number="strokeWidth" 
            min="1" 
            max="20" 
            class="slider"
          />
          <span class="value">{{ strokeWidth }}px</span>
        </div>
        
        <div class="sub-control colors">
          <label>颜色</label>
          <div class="color-presets">
            <button 
              v-for="color in colorPresets" 
              :key="color"
              class="color-btn"
              :class="{ active: brushColor === color }"
              :style="{ backgroundColor: color }"
              @click="brushColor = color"
            ></button>
          </div>
        </div>
      </template>
      
      <!-- 文字设置 -->
      <template v-if="currentMode === 'text'">
        <div class="sub-control">
          <label>字号</label>
          <input 
            type="range" 
            v-model.number="fontSize" 
            min="12" 
            max="100" 
            class="slider"
          />
          <span class="value">{{ fontSize }}px</span>
        </div>
        
        <div class="sub-control colors">
          <label>颜色</label>
          <div class="color-presets">
            <button 
              v-for="color in colorPresets" 
              :key="color"
              class="color-btn"
              :class="{ active: brushColor === color }"
              :style="{ backgroundColor: color }"
              @click="brushColor = color"
            ></button>
          </div>
        </div>
        
        <div class="text-hint">
          💡 点击图片添加文字
        </div>
      </template>
      
      <!-- 滤镜设置 -->
      <template v-if="currentMode === 'filter'">
        <div class="filter-controls">
          <div class="filter-item">
            <label>亮度</label>
            <input type="range" v-model.number="filters.brightness" min="0" max="200" @change="applyFilters" />
            <span>{{ filters.brightness }}%</span>
          </div>
          <div class="filter-item">
            <label>对比度</label>
            <input type="range" v-model.number="filters.contrast" min="0" max="200" @change="applyFilters" />
            <span>{{ filters.contrast }}%</span>
          </div>
          <div class="filter-item">
            <label>饱和度</label>
            <input type="range" v-model.number="filters.saturation" min="0" max="200" @change="applyFilters" />
            <span>{{ filters.saturation }}%</span>
          </div>
          <div class="filter-item">
            <label>模糊</label>
            <input type="range" v-model.number="filters.blur" min="0" max="10" @change="applyFilters" />
            <span>{{ filters.blur }}px</span>
          </div>
          <div class="filter-item">
            <label>灰度</label>
            <input type="range" v-model.number="filters.grayscale" min="0" max="100" @change="applyFilters" />
            <span>{{ filters.grayscale }}%</span>
          </div>
          <div class="filter-item">
            <label>反色</label>
            <input type="range" v-model.number="filters.invert" min="0" max="100" @change="applyFilters" />
            <span>{{ filters.invert }}%</span>
          </div>
          <div class="filter-item">
            <label>复古</label>
            <input type="range" v-model.number="filters.sepia" min="0" max="100" @change="applyFilters" />
            <span>{{ filters.sepia }}%</span>
          </div>
        </div>
        <button class="sub-btn" @click="resetFilters">
          重置滤镜
        </button>
      </template>
    </div>
    
    <!-- 画布区域 -->
    <div class="editor-canvas-container">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
      
      <div class="canvas-wrapper" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }">
        <!-- 主画布 -->
        <canvas 
          ref="mainCanvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
          class="main-canvas"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @click="handleClick"
        ></canvas>
        
        <!-- 覆盖层画布（用于预览、裁剪框等） -->
        <canvas 
          ref="overlayCanvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
          class="overlay-canvas"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
        ></canvas>
        
        <!-- 文字输入框 -->
        <div 
          v-if="showTextInput" 
          class="text-input-overlay"
          :style="{ left: textPosition.x + 'px', top: textPosition.y + 'px' }"
        >
          <input 
            v-model="textContent" 
            type="text" 
            placeholder="输入文字..."
            :style="{ fontSize: fontSize + 'px', color: brushColor }"
            @keyup.enter="addText"
            @keyup.escape="cancelText"
          />
          <div class="text-input-actions">
            <button @click="addText">确定</button>
            <button @click="cancelText">取消</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部操作栏 -->
    <div class="editor-actions">
      <div class="action-info">
        <span v-if="history.length > 0">历史: {{ historyIndex + 1 }}/{{ history.length }}</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn cancel" @click="cancel">
          取消
        </button>
        <button class="action-btn primary" @click="save">
          <span>💾</span> 保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.native-editor-wrapper {
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-height: 100%;
}

/* 工具栏 */
.editor-toolbar {
  background: linear-gradient(135deg, #252545 0%, #1e1e3f 100%);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 8px;
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 60px;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-color: #8b5cf6;
  color: #fff;
}

.tool-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.tool-icon {
  font-size: 18px;
}

.tool-label {
  font-size: 11px;
  font-weight: 500;
}

/* 子工具栏 */
.sub-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
  overflow-x: auto;
}

.sub-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sub-control label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 40px;
}

.sub-control .value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  min-width: 50px;
}

.slider {
  width: 100px;
  accent-color: #8b5cf6;
}

.color-presets {
  display: flex;
  gap: 4px;
}

.color-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.5);
}

.color-picker {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.ratio-btns,
.shape-btns {
  display: flex;
  gap: 4px;
}

.ratio-btn,
.shape-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.ratio-btn:hover,
.shape-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.ratio-btn.active,
.shape-btn.active {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: #fff;
}

.sub-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.sub-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.sub-btn.primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: transparent;
}

.sub-btn.primary:hover {
  filter: brightness(1.1);
}

.mask-hint,
.text-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.2);
  border-radius: 6px;
}

/* 滤镜控制 */
.filter-controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 50px;
}

.filter-item input[type="range"] {
  width: 80px;
  accent-color: #8b5cf6;
}

.filter-item span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 45px;
}

/* 画布区域 */
.editor-canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
  position: relative;
  min-height: 300px;
  overflow: auto;
  padding: 20px;
}

.canvas-wrapper {
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.main-canvas,
.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.main-canvas {
  background: #1a1a2e;
}

.overlay-canvas {
  pointer-events: auto;
}

/* 文字输入 */
.text-input-overlay {
  position: absolute;
  z-index: 10;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px;
}

.text-input-overlay input {
  background: transparent;
  border: none;
  outline: none;
  min-width: 150px;
  font-family: inherit;
}

.text-input-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.text-input-actions button {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.text-input-actions button:first-child {
  background: #8b5cf6;
  border-color: #8b5cf6;
}

/* 加载中 */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部操作栏 */
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, #252545 0%, #1e1e3f 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.action-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

.action-btn.primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  color: #fff;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.action-btn.primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
</style>

