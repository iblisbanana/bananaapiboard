<script setup>
/**
 * ImageCropper.vue - 图片裁剪/扩图组件
 * 
 * 功能特性:
 * - 预设比例裁剪: 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16
 * - 自定义宽高裁剪
 * - 裁剪框可超出图片边界（扩图模式，白色填充）
 * - 裁剪框小于图片时为裁剪
 * - 拖拽调整裁剪区域
 * - 无缝全屏覆盖
 */
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'cancel'])

// DOM 引用
const containerRef = ref(null)
const mainCanvasRef = ref(null)
const overlayCanvasRef = ref(null)

// 状态
const isLoading = ref(true)
const originalImage = new Image()
originalImage.crossOrigin = 'anonymous'

// 画布尺寸（整个可视区域）
const canvasWidth = ref(1200)
const canvasHeight = ref(800)

// 实际图片尺寸
const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

// 图片在画布上的缩放比例和位置
const imageScale = ref(1)
const imageOffsetX = ref(0)
const imageOffsetY = ref(0)
const displayWidth = ref(0)
const displayHeight = ref(0)

// 裁剪状态
const cropRect = ref({ x: 0, y: 0, width: 0, height: 0 })
const selectedRatio = ref('free')

// 自定义尺寸输入
const customWidth = ref(0)
const customHeight = ref(0)
const showCustomInput = ref(false)

// 拖拽状态（使用 ref 确保响应式）
const isDragging = ref(false)
const dragType = ref(null)  // 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
let dragStartPos = { x: 0, y: 0 }
let dragStartRect = { x: 0, y: 0, width: 0, height: 0 }

// 重置拖拽状态
function resetDragState() {
  isDragging.value = false
  dragType.value = null
  dragStartPos = { x: 0, y: 0 }
  dragStartRect = { x: 0, y: 0, width: 0, height: 0 }
}

// 比例预设
const ratioPresets = [
  { value: 'free', label: '自由' },
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
  { value: 'custom', label: '自定义' }
]

// 计算当前是裁剪还是扩图模式
const isExpanding = computed(() => {
  const imgLeft = imageOffsetX.value
  const imgTop = imageOffsetY.value
  const imgRight = imageOffsetX.value + displayWidth.value
  const imgBottom = imageOffsetY.value + displayHeight.value
  
  const cropLeft = cropRect.value.x
  const cropTop = cropRect.value.y
  const cropRight = cropRect.value.x + cropRect.value.width
  const cropBottom = cropRect.value.y + cropRect.value.height
  
  // 如果裁剪框任意边超出图片边界，则为扩图模式
  return cropLeft < imgLeft || cropTop < imgTop || cropRight > imgRight || cropBottom > imgBottom
})

// 计算实际输出尺寸
const outputSize = computed(() => {
  const scaleToOriginal = 1 / imageScale.value
  return {
    width: Math.round(cropRect.value.width * scaleToOriginal),
    height: Math.round(cropRect.value.height * scaleToOriginal)
  }
})

// 计算容器尺寸
function calculateCanvasSize() {
  if (!containerRef.value) return
  
  const padding = 60
  const maxWidth = window.innerWidth - padding * 2
  const maxHeight = window.innerHeight - 180
  
  canvasWidth.value = Math.min(maxWidth, 1400)
  canvasHeight.value = Math.min(maxHeight, 900)
}

// 加载图片
async function loadImage(url) {
  isLoading.value = true
  
  return new Promise((resolve, reject) => {
    originalImage.onload = () => {
      imageNaturalWidth.value = originalImage.naturalWidth
      imageNaturalHeight.value = originalImage.naturalHeight
      
      // 计算缩放比例，使图片适应画布（留出扩图空间）
      const maxDisplayRatio = 0.6 // 图片最多占画布60%
      const scaleX = (canvasWidth.value * maxDisplayRatio) / originalImage.naturalWidth
      const scaleY = (canvasHeight.value * maxDisplayRatio) / originalImage.naturalHeight
      imageScale.value = Math.min(scaleX, scaleY, 1)
      
      // 计算显示尺寸
      displayWidth.value = originalImage.naturalWidth * imageScale.value
      displayHeight.value = originalImage.naturalHeight * imageScale.value
      
      // 居中偏移
      imageOffsetX.value = (canvasWidth.value - displayWidth.value) / 2
      imageOffsetY.value = (canvasHeight.value - displayHeight.value) / 2
      
      // 初始化自定义尺寸为原图尺寸
      customWidth.value = originalImage.naturalWidth
      customHeight.value = originalImage.naturalHeight
      
      isLoading.value = false
      resolve()
    }
    originalImage.onerror = (err) => {
      isLoading.value = false
      reject(err)
    }
    originalImage.src = url
  })
}

// 绘制主画布
function drawMainCanvas() {
  const canvas = mainCanvasRef.value
  if (!canvas || !originalImage.complete) return
  
  const ctx = canvas.getContext('2d')
  
  // 清除画布，使用深色背景
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 绘制图片（居中）
  ctx.drawImage(
    originalImage,
    imageOffsetX.value,
    imageOffsetY.value,
    displayWidth.value,
    displayHeight.value
  )
}

// 初始化裁剪区域（默认覆盖整个图片）
function initCropRect() {
  cropRect.value = {
    x: imageOffsetX.value,
    y: imageOffsetY.value,
    width: displayWidth.value,
    height: displayHeight.value
  }
}

// 根据比例调整裁剪区域
function applyRatio(ratio) {
  selectedRatio.value = ratio
  showCustomInput.value = ratio === 'custom'
  
  if (ratio === 'free' || ratio === 'custom') return
  
  const [w, h] = ratio.split(':').map(Number)
  const targetRatio = w / h
  
  // 以图片中心为基准调整
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2
  
  let newWidth, newHeight
  
  // 基于当前裁剪区域调整
  if (cropRect.value.width / cropRect.value.height > targetRatio) {
    newHeight = cropRect.value.height
    newWidth = newHeight * targetRatio
  } else {
    newWidth = cropRect.value.width
    newHeight = newWidth / targetRatio
  }
  
  // 确保尺寸不会太小
  const minSize = 100
  if (newWidth < minSize) {
    newWidth = minSize
    newHeight = newWidth / targetRatio
  }
  if (newHeight < minSize) {
    newHeight = minSize
    newWidth = newHeight * targetRatio
  }
  
  cropRect.value = {
    x: centerX - newWidth / 2,
    y: centerY - newHeight / 2,
    width: newWidth,
    height: newHeight
  }
  
  drawCropOverlay()
}

// 应用自定义尺寸
function applyCustomSize() {
  if (customWidth.value < 10 || customHeight.value < 10) return
  
  const scaleToDisplay = imageScale.value
  const newWidth = customWidth.value * scaleToDisplay
  const newHeight = customHeight.value * scaleToDisplay
  
  // 居中放置
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2
  
  cropRect.value = {
    x: centerX - newWidth / 2,
    y: centerY - newHeight / 2,
    width: newWidth,
    height: newHeight
  }
  
  drawCropOverlay()
}

// 绘制裁剪遮罩
function drawCropOverlay() {
  const canvas = overlayCanvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  const { x, y, width, height } = cropRect.value
  
  // 绘制半透明遮罩（整个画布）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 清除裁剪区域
  ctx.clearRect(x, y, width, height)
  
  // 在裁剪区域内，绘制超出图片部分的白色填充（预览扩图效果）
  const imgLeft = imageOffsetX.value
  const imgTop = imageOffsetY.value
  const imgRight = imageOffsetX.value + displayWidth.value
  const imgBottom = imageOffsetY.value + displayHeight.value
  
  ctx.fillStyle = '#ffffff'
  
  // 左侧扩展区域
  if (x < imgLeft) {
    ctx.fillRect(x, Math.max(y, imgTop), imgLeft - x, Math.min(y + height, imgBottom) - Math.max(y, imgTop))
  }
  // 右侧扩展区域
  if (x + width > imgRight) {
    ctx.fillRect(imgRight, Math.max(y, imgTop), x + width - imgRight, Math.min(y + height, imgBottom) - Math.max(y, imgTop))
  }
  // 上方扩展区域
  if (y < imgTop) {
    ctx.fillRect(x, y, width, imgTop - y)
  }
  // 下方扩展区域
  if (y + height > imgBottom) {
    ctx.fillRect(x, imgBottom, width, y + height - imgBottom)
  }
  
  // 裁剪框边框
  ctx.strokeStyle = isExpanding.value ? '#10b981' : '#fff'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
  
  // 三分法网格线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  
  ctx.beginPath()
  ctx.moveTo(x + width / 3, y)
  ctx.lineTo(x + width / 3, y + height)
  ctx.moveTo(x + width * 2 / 3, y)
  ctx.lineTo(x + width * 2 / 3, y + height)
  ctx.moveTo(x, y + height / 3)
  ctx.lineTo(x + width, y + height / 3)
  ctx.moveTo(x, y + height * 2 / 3)
  ctx.lineTo(x + width, y + height * 2 / 3)
  ctx.stroke()
  
  // 角落控制点
  const cornerSize = 14
  ctx.fillStyle = '#fff'
  
  drawCornerHandle(ctx, x, y, cornerSize, 'nw')
  drawCornerHandle(ctx, x + width - cornerSize, y, cornerSize, 'ne')
  drawCornerHandle(ctx, x, y + height - cornerSize, cornerSize, 'sw')
  drawCornerHandle(ctx, x + width - cornerSize, y + height - cornerSize, cornerSize, 'se')
  
  // 边缘控制点
  const edgeSize = 6
  const edgeLen = 24
  ctx.fillStyle = '#fff'
  
  // 上边
  ctx.fillRect(x + width / 2 - edgeLen / 2, y - edgeSize / 2, edgeLen, edgeSize)
  // 下边
  ctx.fillRect(x + width / 2 - edgeLen / 2, y + height - edgeSize / 2, edgeLen, edgeSize)
  // 左边
  ctx.fillRect(x - edgeSize / 2, y + height / 2 - edgeLen / 2, edgeSize, edgeLen)
  // 右边
  ctx.fillRect(x + width - edgeSize / 2, y + height / 2 - edgeLen / 2, edgeSize, edgeLen)
  
  // 显示输出尺寸和模式
  const sizeText = `${outputSize.value.width} × ${outputSize.value.height}`
  const modeText = isExpanding.value ? '扩图' : '裁剪'
  
  ctx.font = '13px system-ui, sans-serif'
  const textWidth = Math.max(ctx.measureText(sizeText).width, ctx.measureText(modeText).width)
  
  // 尺寸标签背景
  const labelX = x + width / 2
  const labelY = y + height + 16
  
  ctx.fillStyle = isExpanding.value ? 'rgba(16, 185, 129, 0.9)' : 'rgba(0, 0, 0, 0.8)'
  ctx.beginPath()
  ctx.roundRect(labelX - textWidth / 2 - 16, labelY - 10, textWidth + 32, 44, 8)
  ctx.fill()
  
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(sizeText, labelX, labelY + 4)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(modeText, labelX, labelY + 22)
}

function drawCornerHandle(ctx, x, y, size, type) {
  const thickness = 4
  
  ctx.beginPath()
  switch (type) {
    case 'nw':
      ctx.rect(x, y, size, thickness)
      ctx.rect(x, y, thickness, size)
      break
    case 'ne':
      ctx.rect(x, y, size, thickness)
      ctx.rect(x + size - thickness, y, thickness, size)
      break
    case 'sw':
      ctx.rect(x, y + size - thickness, size, thickness)
      ctx.rect(x, y, thickness, size)
      break
    case 'se':
      ctx.rect(x, y + size - thickness, size, thickness)
      ctx.rect(x + size - thickness, y, thickness, size)
      break
  }
  ctx.fill()
}

// 检测点击位置对应的拖拽类型
function getDragType(x, y) {
  const { x: cx, y: cy, width: cw, height: ch } = cropRect.value
  const threshold = 20
  
  // 角落检测
  if (Math.abs(x - cx) < threshold && Math.abs(y - cy) < threshold) return 'nw'
  if (Math.abs(x - (cx + cw)) < threshold && Math.abs(y - cy) < threshold) return 'ne'
  if (Math.abs(x - cx) < threshold && Math.abs(y - (cy + ch)) < threshold) return 'sw'
  if (Math.abs(x - (cx + cw)) < threshold && Math.abs(y - (cy + ch)) < threshold) return 'se'
  
  // 边缘检测
  if (Math.abs(y - cy) < threshold && x > cx + threshold && x < cx + cw - threshold) return 'n'
  if (Math.abs(y - (cy + ch)) < threshold && x > cx + threshold && x < cx + cw - threshold) return 's'
  if (Math.abs(x - cx) < threshold && y > cy + threshold && y < cy + ch - threshold) return 'w'
  if (Math.abs(x - (cx + cw)) < threshold && y > cy + threshold && y < cy + ch - threshold) return 'e'
  
  // 内部移动
  if (x > cx && x < cx + cw && y > cy && y < cy + ch) return 'move'
  
  return null
}

// 获取鼠标相对于 canvas 的坐标
function getCanvasCoords(e) {
  const canvas = overlayCanvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  
  const rect = canvas.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

// 开始拖拽
function handleMouseDown(e) {
  const { x, y } = getCanvasCoords(e)
  const type = getDragType(x, y)
  
  if (type) {
    isDragging.value = true
    dragType.value = type
    dragStartPos = { x, y }
    dragStartRect = { ...cropRect.value }
  }
}

// 拖拽中
function handleMouseMove(e) {
  const { x, y } = getCanvasCoords(e)
  
  // 更新光标
  const type = getDragType(x, y)
  updateCursor(type)
  
  if (!isDragging.value || !dragType.value) return
  
  const dx = x - dragStartPos.x
  const dy = y - dragStartPos.y
  
  const newRect = { ...dragStartRect }
  const minSize = 50
  const padding = 30 // 画布边距
  
  // 根据拖拽类型调整裁剪区域
  switch (dragType.value) {
    case 'move':
      newRect.x = dragStartRect.x + dx
      newRect.y = dragStartRect.y + dy
      break
    case 'nw':
      newRect.x = dragStartRect.x + dx
      newRect.y = dragStartRect.y + dy
      newRect.width = dragStartRect.width - dx
      newRect.height = dragStartRect.height - dy
      break
    case 'ne':
      newRect.y = dragStartRect.y + dy
      newRect.width = dragStartRect.width + dx
      newRect.height = dragStartRect.height - dy
      break
    case 'sw':
      newRect.x = dragStartRect.x + dx
      newRect.width = dragStartRect.width - dx
      newRect.height = dragStartRect.height + dy
      break
    case 'se':
      newRect.width = dragStartRect.width + dx
      newRect.height = dragStartRect.height + dy
      break
    case 'n':
      newRect.y = dragStartRect.y + dy
      newRect.height = dragStartRect.height - dy
      break
    case 's':
      newRect.height = dragStartRect.height + dy
      break
    case 'w':
      newRect.x = dragStartRect.x + dx
      newRect.width = dragStartRect.width - dx
      break
    case 'e':
      newRect.width = dragStartRect.width + dx
      break
  }
  
  // 应用比例约束
  if (selectedRatio.value !== 'free' && selectedRatio.value !== 'custom' && dragType.value !== 'move') {
    const [w, h] = selectedRatio.value.split(':').map(Number)
    const ratio = w / h
    
    if (['nw', 'ne', 'sw', 'se', 'e', 'w'].includes(dragType.value)) {
      newRect.height = newRect.width / ratio
    } else {
      newRect.width = newRect.height * ratio
    }
  }
  
  // 确保最小尺寸
  if (newRect.width < minSize || newRect.height < minSize) return
  
  // 限制在画布边界内（允许超出图片边界，实现扩图）
  newRect.x = Math.max(padding, Math.min(newRect.x, canvasWidth.value - newRect.width - padding))
  newRect.y = Math.max(padding, Math.min(newRect.y, canvasHeight.value - newRect.height - padding))
  
  // 确保裁剪框不会太大超出画布
  if (newRect.x + newRect.width > canvasWidth.value - padding) {
    newRect.width = canvasWidth.value - padding - newRect.x
  }
  if (newRect.y + newRect.height > canvasHeight.value - padding) {
    newRect.height = canvasHeight.value - padding - newRect.y
  }
  
  cropRect.value = newRect
  
  // 更新自定义尺寸输入
  customWidth.value = outputSize.value.width
  customHeight.value = outputSize.value.height
  
  drawCropOverlay()
}

// 结束拖拽
function handleMouseUp() {
  isDragging.value = false
  dragType.value = null
}

// 更新光标样式
function updateCursor(type) {
  const canvas = overlayCanvasRef.value
  if (!canvas) return
  
  const cursorMap = {
    'nw': 'nwse-resize',
    'se': 'nwse-resize',
    'ne': 'nesw-resize',
    'sw': 'nesw-resize',
    'n': 'ns-resize',
    's': 'ns-resize',
    'e': 'ew-resize',
    'w': 'ew-resize',
    'move': 'move'
  }
  
  canvas.style.cursor = cursorMap[type] || 'default'
}

// 应用裁剪/扩图
function applyCrop() {
  const scaleToOriginal = 1 / imageScale.value
  
  // 计算裁剪区域相对于原图的位置
  const cropX = (cropRect.value.x - imageOffsetX.value) * scaleToOriginal
  const cropY = (cropRect.value.y - imageOffsetY.value) * scaleToOriginal
  const cropW = cropRect.value.width * scaleToOriginal
  const cropH = cropRect.value.height * scaleToOriginal
  
  // 创建结果画布
  const resultCanvas = document.createElement('canvas')
  resultCanvas.width = Math.round(cropW)
  resultCanvas.height = Math.round(cropH)
  const resultCtx = resultCanvas.getContext('2d')
  
  // 先填充白色背景（用于扩图区域）
  resultCtx.fillStyle = '#ffffff'
  resultCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height)
  
  // 计算图片在结果画布中的位置
  const drawX = -cropX
  const drawY = -cropY
  
  // 绘制原图
  resultCtx.drawImage(
    originalImage,
    drawX,
    drawY,
    imageNaturalWidth.value,
    imageNaturalHeight.value
  )
  
  // 转换为 DataURL
  const dataUrl = resultCanvas.toDataURL('image/png')
  
  emit('save', {
    dataUrl,
    width: resultCanvas.width,
    height: resultCanvas.height,
    isExpanded: isExpanding.value
  })
}

// 取消
function handleCancel() {
  emit('cancel')
}

// 重置裁剪区域
function resetCrop() {
  selectedRatio.value = 'free'
  showCustomInput.value = false
  initCropRect()
  customWidth.value = imageNaturalWidth.value
  customHeight.value = imageNaturalHeight.value
  drawCropOverlay()
}

// 键盘事件
function handleKeyDown(e) {
  if (!props.visible) return
  
  if (e.key === 'Escape') {
    handleCancel()
  } else if (e.key === 'Enter' && !showCustomInput.value) {
    applyCrop()
  }
}

// 初始化
async function init() {
  // 重置拖拽状态
  resetDragState()
  
  calculateCanvasSize()
  await loadImage(props.imageUrl)
  
  nextTick(() => {
    drawMainCanvas()
    initCropRect()
    drawCropOverlay()
  })
}

// 监听可见性变化
watch(() => props.visible, async (visible) => {
  if (visible) {
    await init()
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', calculateCanvasSize)
    window.addEventListener('mouseup', handleMouseUp)
  } else {
    document.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('resize', calculateCanvasSize)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}, { immediate: true })

// 监听图片URL变化
watch(() => props.imageUrl, async (newUrl) => {
  if (newUrl && props.visible) {
    await init()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', calculateCanvasSize)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cropper-fade">
      <div v-if="visible" class="image-cropper-overlay">
        <div class="cropper-container" ref="containerRef">
          <!-- 头部工具栏 -->
          <div class="cropper-header">
            <div class="header-left">
              <button class="close-btn" @click="handleCancel" title="取消 (ESC)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <span class="title">裁剪 / 扩图</span>
            </div>
            
            <div class="header-center">
              <!-- 比例选择 -->
              <div class="ratio-selector">
                <button
                  v-for="ratio in ratioPresets"
                  :key="ratio.value"
                  class="ratio-btn"
                  :class="{ active: selectedRatio === ratio.value }"
                  @click="applyRatio(ratio.value)"
                >
                  {{ ratio.label }}
                </button>
              </div>
              
              <!-- 自定义尺寸输入 -->
              <Transition name="custom-fade">
                <div v-if="showCustomInput" class="custom-size-input">
                  <input
                    type="number"
                    v-model.number="customWidth"
                    min="10"
                    max="8192"
                    placeholder="宽"
                    class="size-input"
                    @keyup.enter="applyCustomSize"
                  />
                  <span class="size-separator">×</span>
                  <input
                    type="number"
                    v-model.number="customHeight"
                    min="10"
                    max="8192"
                    placeholder="高"
                    class="size-input"
                    @keyup.enter="applyCustomSize"
                  />
                  <button class="apply-size-btn" @click="applyCustomSize">
                    应用
                  </button>
                </div>
              </Transition>
            </div>
            
            <div class="header-right">
              <button class="reset-btn" @click="resetCrop" title="重置">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                重置
              </button>
              <button class="confirm-btn" @click="applyCrop" title="确认 (Enter)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ isExpanding ? '确认扩图' : '确认裁剪' }}
              </button>
            </div>
          </div>
          
          <!-- 裁剪区域 -->
          <div class="cropper-content">
            <div v-if="isLoading" class="loading-overlay">
              <div class="loading-spinner"></div>
              <span>加载中...</span>
            </div>
            
            <div class="canvas-wrapper" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }">
              <canvas
                ref="mainCanvasRef"
                :width="canvasWidth"
                :height="canvasHeight"
                class="main-canvas"
              />
              <canvas
                ref="overlayCanvasRef"
                :width="canvasWidth"
                :height="canvasHeight"
                class="overlay-canvas"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseUp"
              />
            </div>
          </div>
          
          <!-- 底部提示 -->
          <div class="cropper-footer">
            <div class="mode-indicator" :class="{ expanding: isExpanding }">
              <span class="mode-dot"></span>
              <span>{{ isExpanding ? '扩图模式 - 超出原图部分将填充白色' : '裁剪模式' }}</span>
            </div>
            <span class="hint">拖拽边框调整区域 · 框超出图片即为扩图 · Enter 确认 · ESC 取消</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.image-cropper-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.98);
  z-index: 100001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cropper-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
}

.cropper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(30, 30, 30, 0.9);
  border-radius: 10px;
  margin-bottom: 12px;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.close-btn {
  width: 34px;
  height: 34px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.close-btn svg {
  width: 18px;
  height: 18px;
  color: #fff;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ratio-selector {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.4);
  padding: 3px;
  border-radius: 8px;
}

.ratio-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}

.ratio-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.ratio-btn.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.custom-size-input {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 8px;
  border-radius: 8px;
}

.size-input {
  width: 70px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  text-align: center;
}

.size-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.6);
}

.size-input::-webkit-inner-spin-button,
.size-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.size-separator {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.apply-size-btn {
  padding: 6px 12px;
  border: none;
  background: rgba(99, 102, 241, 0.6);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
}

.apply-size-btn:hover {
  background: rgba(99, 102, 241, 0.8);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.reset-btn,
.confirm-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.reset-btn svg,
.confirm-btn svg {
  width: 15px;
  height: 15px;
}

.confirm-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
}

.cropper-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.7);
  z-index: 10;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.canvas-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.main-canvas {
  display: block;
  background: #1a1a1a;
}

.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: default;
}

.cropper-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.mode-indicator.expanding {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.mode-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
}

.mode-indicator.expanding .mode-dot {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

/* 过渡动画 */
.cropper-fade-enter-active,
.cropper-fade-leave-active {
  transition: all 0.25s ease;
}

.cropper-fade-enter-from,
.cropper-fade-leave-to {
  opacity: 0;
}

.custom-fade-enter-active,
.custom-fade-leave-active {
  transition: all 0.2s ease;
}

.custom-fade-enter-from,
.custom-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
