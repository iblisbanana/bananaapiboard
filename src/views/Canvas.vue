<script setup>
/**
 * Canvas.vue - 创作者画布主页面
 */
import { ref, computed, watch, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getMe } from '@/api/client'
import { useCanvasStore } from '@/stores/canvas'
import { loadWorkflow as loadWorkflowFromServer } from '@/api/canvas/workflow'
import CanvasBoard from '@/components/canvas/CanvasBoard.vue'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import CanvasEmptyState from '@/components/canvas/CanvasEmptyState.vue'
import NodeSelector from '@/components/canvas/NodeSelector.vue'
import NodeContextMenu from '@/components/canvas/NodeContextMenu.vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import WorkflowTemplates from '@/components/canvas/WorkflowTemplates.vue'
import GroupToolbar from '@/components/canvas/GroupToolbar.vue'
import SaveWorkflowDialog from '@/components/canvas/SaveWorkflowDialog.vue'

// 导入画布样式
import '@/styles/canvas.css'

const router = useRouter()
const route = useRoute()
const canvasStore = useCanvasStore()

// 用户信息
const me = ref(null)
const loading = ref(true)
const canvasReady = ref(false) // 画布是否准备好渲染（等待转场动画完成）

// 模板面板
const showTemplates = ref(false)

// 帮助面板
const showHelp = ref(false)

// 保存工作流对话框
const showSaveDialog = ref(false)

// 模式切换
const isTransitioning = ref(false)
const showModePopup = ref(false)
let modeHoverTimer = null

// 鼠标进入模式切换按钮
function handleModeSwitchEnter() {
  // 1.5秒后显示弹窗
  modeHoverTimer = setTimeout(() => {
    showModePopup.value = true
  }, 1500)
}

// 鼠标离开模式切换按钮
function handleModeSwitchLeave() {
  if (modeHoverTimer) {
    clearTimeout(modeHoverTimer)
    modeHoverTimer = null
  }
}

// 点击模式切换按钮 - 直接显示弹窗
function handleModeSwitchClick() {
  if (modeHoverTimer) {
    clearTimeout(modeHoverTimer)
    modeHoverTimer = null
  }
  showModePopup.value = true
}

// 关闭模式弹窗
function closeModePopup() {
  showModePopup.value = false
}

// 确认切换到新手模式
async function confirmSwitchToSimpleMode() {
  if (isTransitioning.value) return
  isTransitioning.value = true
  showModePopup.value = false
  
  // 保存模式选择
  localStorage.setItem('userMode', 'simple')
  
  // 通知 App.vue 刷新用户信息，确保导航栏显示正确的登录状态
  window.dispatchEvent(new CustomEvent('user-info-updated'))
  
  // 等待转场动画
  await nextTick()
  setTimeout(() => {
    router.push('/generate')
  }, 600)
}

// 选中的编组节点
const selectedGroupNode = computed(() => {
  // 检查 selectedNodeId
  const selectedId = canvasStore.selectedNodeId
  if (!selectedId) return null
  
  // 查找节点
  const node = canvasStore.nodes.find(n => n.id === selectedId)
  if (node && node.type === 'group') {
    console.log('[Canvas] 检测到选中编组:', node.id)
    return node
  }
  return null
})

// 显示编组工具栏
const showGroupToolbar = computed(() => {
  return selectedGroupNode.value !== null
})

// 编组工具栏位置
const groupToolbarPosition = computed(() => {
  if (!selectedGroupNode.value) return { x: 0, y: 0 }
  
  const node = selectedGroupNode.value
  const viewport = canvasStore.viewport
  
  // 计算工具栏位置（在编组上方居中，保持一定距离）
  const container = document.querySelector('.canvas-board')
  if (!container) return { x: window.innerWidth / 2, y: 100 }
  
  const rect = container.getBoundingClientRect()
  const nodeWidth = node.data?.width || 400
  
  const x = rect.left + (node.position.x * viewport.zoom) + viewport.x + (nodeWidth * viewport.zoom) / 2
  // 增加与编组的距离（-50 改为固定在屏幕顶部附近）
  const y = Math.max(60, rect.top + (node.position.y * viewport.zoom) + viewport.y - 50)
  
  return { x: Math.max(250, x), y }
})

// 提供用户信息给子组件
provide('userInfo', me)

// 打开模板面板
function openTemplates() {
  showTemplates.value = true
}

// 关闭模板面板
function closeTemplates() {
  showTemplates.value = false
}

// 提供打开模板函数给子组件
provide('openTemplates', openTemplates)

// 打开保存对话框
function openSaveDialog() {
  showSaveDialog.value = true
}

// 关闭保存对话框
function closeSaveDialog() {
  showSaveDialog.value = false
}

// 保存成功回调
function handleWorkflowSaved(workflow) {
  console.log('[Canvas] 工作流保存成功:', workflow)
  // 可以显示成功提示
  alert(`工作流 "${workflow.name}" 保存成功！`)
}

// 加载用户信息
async function loadUserInfo() {
  try {
    me.value = await getMe()
    if (!me.value) {
      // 未登录，跳转到落地页
      router.push('/')
    }
  } catch (e) {
    console.error('[Canvas] 加载用户信息失败:', e)
  } finally {
    loading.value = false
  }
}

// 处理画布双击 - 双击空白处弹出节点选择器
function handleCanvasDoubleClick(event) {
  // 获取画布容器来计算画布坐标
  const container = document.querySelector('.canvas-board')
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const viewport = canvasStore.viewport
  
  // 将屏幕坐标转换为画布坐标
  const flowX = (event.clientX - rect.left - viewport.x) / viewport.zoom
  const flowY = (event.clientY - rect.top - viewport.y) / viewport.zoom
  
  // 打开节点选择器，并传入 flowPosition
  canvasStore.openNodeSelector(
    { x: event.clientX, y: event.clientY }, 
    'canvas', 
    null, 
    { x: flowX, y: flowY }
  )
}

// 处理点击空白处
function handleCanvasClick(event) {
  // 如果刚刚通过连线拖拽打开了选择器，忽略这次点击
  if (canvasStore.preventSelectorClose) {
    console.log('[Canvas] 忽略点击，因为刚刚通过连线打开了选择器')
    return
  }
  
  // 关闭菜单
  if (canvasStore.isNodeSelectorOpen) {
    canvasStore.closeNodeSelector()
  }
  canvasStore.closeAllContextMenus()
  
  // 点击空白处时隐藏底部面板
  canvasStore.isBottomPanelVisible = false
}

// 处理画布右键菜单的上传事件
function handleCanvasUpload(type) {
  // 打开文件选择器上传
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = type === 'image' ? 'image/*' : 'video/*'
  input.multiple = type === 'image' // 图片支持多选
  
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    const position = canvasStore.canvasContextMenuPosition
    const baseX = position.flowX || 100
    const baseY = position.flowY || 100
    
    if (type === 'image') {
      // 过滤出图片文件
      const imageFiles = files.filter(f => f.type.startsWith('image/'))
      
      if (imageFiles.length === 0) {
        console.warn('[Canvas] 没有选择有效的图片文件')
        return
      }
      
      // 每个图片创建一个节点，或者多张图片合并到一个节点
      if (imageFiles.length === 1) {
        // 单张图片：创建一个节点
        const url = URL.createObjectURL(imageFiles[0])
        canvasStore.addNode({
          type: 'image-input',
          position: { x: baseX, y: baseY },
          data: { 
            images: [url],
            fileName: imageFiles[0].name 
          }
        })
        console.log(`[Canvas] 上传图片: ${imageFiles[0].name}`)
      } else {
        // 多张图片：可以选择创建多个节点或一个节点
        // 这里我们为每张图片创建一个独立节点，并排列布局
        const nodeWidth = 250
        const nodeHeight = 200
        const gap = 30
        const columns = Math.ceil(Math.sqrt(imageFiles.length))
        
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i]
          const url = URL.createObjectURL(file)
          
          // 计算节点位置（网格布局）
          const col = i % columns
          const row = Math.floor(i / columns)
          const nodeX = baseX + col * (nodeWidth + gap)
          const nodeY = baseY + row * (nodeHeight + gap)
          
          canvasStore.addNode({
            type: 'image-input',
            position: { x: nodeX, y: nodeY },
            data: { 
              images: [url],
              fileName: file.name 
            }
          })
        }
        console.log(`[Canvas] 上传 ${imageFiles.length} 张图片`)
      }
    } else if (type === 'video') {
      // 视频只处理第一个文件
      const videoFile = files.find(f => f.type.startsWith('video/'))
      if (!videoFile) {
        console.warn('[Canvas] 没有选择有效的视频文件')
        return
      }
      
      const url = URL.createObjectURL(videoFile)
      canvasStore.addNode({
        type: 'video-input',
        position: { x: baseX, y: baseY },
        data: { 
          video: url,
          fileName: videoFile.name 
        }
      })
      console.log(`[Canvas] 上传视频: ${videoFile.name}`)
    }
  }
  
  input.click()
}

// 处理画布右键菜单的添加节点事件
function handleCanvasAddNode(position) {
  // 从位置对象中提取 flowPosition
  const flowPosition = (position.flowX !== undefined && position.flowY !== undefined)
    ? { x: position.flowX, y: position.flowY }
    : null
    
  canvasStore.openNodeSelector(position, 'canvas', null, flowPosition)
}

// 键盘快捷键（页面级别）
// 注意：大部分快捷键已移至 CanvasBoard.vue 中实现
function handleKeyDown(event) {
  // 检查是否在输入框或可编辑区域中
  const target = event.target
  const isInInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable ||
                    target.closest('[contenteditable="true"]')
  
  // Escape 关闭弹窗
  if (event.key === 'Escape') {
    canvasStore.closeNodeSelector()
    canvasStore.closeAllContextMenus()
    // 不清除选择，让用户可以继续操作选中的节点
  }
  
  // Delete 或 Backspace 删除选中的节点
  if ((event.key === 'Delete' || event.key === 'Backspace') && !isInInput) {
    event.preventDefault() // 阻止默认行为
    
    // 检查是否有选中的节点
    if (canvasStore.selectedNodeId) {
      const selectedNode = canvasStore.nodes.find(n => n.id === canvasStore.selectedNodeId)
      
      // 如果是编组节点，需要特殊处理
      if (selectedNode?.type === 'group') {
        if (confirm('确定要删除这个编组吗？编组内的节点将被恢复为独立节点。')) {
          handleDisbandGroup()
        }
      } else {
        // 普通节点直接删除
        canvasStore.removeNode(canvasStore.selectedNodeId)
        canvasStore.selectedNodeId = null
      }
    }
  }
}

// 处理解散编组
function handleDisbandGroup() {
  if (selectedGroupNode.value) {
    const groupId = selectedGroupNode.value.id
    const nodeIds = selectedGroupNode.value.data?.nodeIds || []
    
    // 恢复组内节点的可拖拽状态
    nodeIds.forEach(nodeId => {
      const node = canvasStore.nodes.find(n => n.id === nodeId)
      if (node) {
        node.draggable = true
      }
    })
    
    canvasStore.disbandGroup(groupId)
    canvasStore.removeNode(groupId)
  }
}

// 处理整组执行
function handleExecuteGroup() {
  if (selectedGroupNode.value) {
    const nodeIds = selectedGroupNode.value.data?.nodeIds || []
    console.log('[Canvas] 整组执行', nodeIds)
    // TODO: 实现批量执行逻辑
    alert(`将执行编组内 ${nodeIds.length} 个节点的生成任务`)
  }
}

// 处理保存工作流
function handleSaveWorkflow() {
  const workflow = canvasStore.exportWorkflow()
  console.log('[Canvas] 保存工作流', workflow)
  // TODO: 实现保存工作流逻辑
  alert('工作流已保存（功能开发中）')
}

onMounted(async () => {
  await loadUserInfo()
  
  // 检查URL参数，如果有load参数则加载工作流
  const loadWorkflowId = route.query.load
  if (loadWorkflowId && me.value) {
    try {
      console.log('[Canvas] 从URL加载工作流:', loadWorkflowId)
      const result = await loadWorkflowFromServer(loadWorkflowId)
      
      if (result.workflow) {
        const workflow = result.workflow
        
        // 设置工作流元信息
        canvasStore.workflowMeta = {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description
        }
        
        // 加载工作流到画布
        canvasStore.loadWorkflow(workflow)
      }
    } catch (error) {
      console.error('[Canvas] 加载工作流失败:', error)
      alert('加载工作流失败：' + error.message)
    }
  }
  
  document.addEventListener('keydown', handleKeyDown)
  
  // 延迟设置画布就绪状态，确保转场动画完成后再渲染 VueFlow
  // 这解决了转场动画与 VueFlow 初始化冲突导致画布卡住的问题
  await nextTick()
  
  // 使用更长的延迟确保页面完全稳定
  setTimeout(() => {
    canvasReady.value = true
    console.log('[Canvas] 画布已就绪')
    
    // 强制触发一次重绘
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }, 150)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="canvas-page" :class="{ 'is-transitioning': isTransitioning }">
    <!-- 转场遮罩 -->
    <Transition name="page-transition">
      <div v-if="isTransitioning" class="transition-overlay">
        <div class="transition-content">
          <div class="transition-spinner"></div>
          <span>切换中...</span>
        </div>
      </div>
    </Transition>

    <!-- 模式切换按钮 -->
    <!-- 模式切换按钮 -->
    <div 
      class="mode-switch-btn"
      @mouseenter="handleModeSwitchEnter"
      @mouseleave="handleModeSwitchLeave"
      @click="handleModeSwitchClick"
    >
      <div class="mode-switch-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
    </div>

    <!-- 模式切换弹窗 -->
    <Transition name="popup-fade">
      <div v-if="showModePopup" class="mode-popup-overlay" @click.self="closeModePopup">
        <div class="mode-popup">
          <div class="mode-popup-header">
            <span class="mode-popup-title">切换模式</span>
            <button class="mode-popup-close" @click="closeModePopup">×</button>
          </div>
          <div class="mode-popup-content">
            <p>确定要切换到新手模式吗？</p>
            <p class="mode-popup-hint">新手模式提供更简洁的界面，适合快速创作</p>
          </div>
          <div class="mode-popup-actions">
            <button class="mode-popup-btn cancel" @click="closeModePopup">取消</button>
            <button class="mode-popup-btn confirm" @click="confirmSwitchToSimpleMode">切换为新手模式</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 加载状态 -->
    <div v-if="loading || !canvasReady" class="canvas-loading-screen">
      <div class="canvas-loading">
        <div class="canvas-loading-spinner"></div>
        <span>{{ loading ? '加载中...' : '准备画布...' }}</span>
      </div>
    </div>
    
    <!-- 画布主体 -->
    <div v-else class="canvas-container" @click="handleCanvasClick">
      <!-- 无限画布 - 使用 key 强制在就绪后重新挂载 -->
      <CanvasBoard :key="'canvas-board-' + canvasReady" @dblclick="handleCanvasDoubleClick" />
      
      <!-- 左侧工具栏 -->
      <CanvasToolbar @open-save-dialog="openSaveDialog" />
      
      <!-- 空白状态引导 -->
      <CanvasEmptyState v-if="canvasStore.isEmpty" />
      
      <!-- 缩放控制 -->
      <div class="canvas-zoom-controls">
        <button class="canvas-zoom-btn" @click="() => {}">−</button>
        <span class="canvas-zoom-value">{{ Math.round(canvasStore.viewport.zoom * 100) }}%</span>
        <button class="canvas-zoom-btn" @click="() => {}">+</button>
      </div>
      
      <!-- 帮助按钮 -->
      <button class="canvas-help-btn" title="帮助" @click="showHelp = true">?</button>
      
      <!-- 帮助弹窗 -->
      <div v-if="showHelp" class="canvas-help-modal" @click.self="showHelp = false">
        <div class="canvas-help-content">
          <div class="canvas-help-header">
            <h3>🎨 画布操作指南</h3>
            <button class="canvas-help-close" @click="showHelp = false">×</button>
          </div>
          <div class="canvas-help-body">
            <div class="help-section">
              <h4>🖱️ 鼠标操作</h4>
              <ul>
                <li><kbd>左键拖拽</kbd> 平移画布</li>
                <li><kbd>右键点击</kbd> 打开快捷菜单</li>
                <li><kbd>Ctrl+拖拽</kbd> 框选多个节点</li>
                <li><kbd>空格+拖拽</kbd> 平移画布</li>
                <li><kbd>左键单击</kbd> 选中节点</li>
                <li><kbd>双击空白处</kbd> 添加新节点</li>
                <li><kbd>滚轮↑</kbd> 以光标为中心放大</li>
                <li><kbd>滚轮↓</kbd> 以光标为中心缩小</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>⌨️ 快捷键</h4>
              <ul>
                <li><kbd>Ctrl+Z</kbd> 撤销</li>
                <li><kbd>Ctrl+Y</kbd> 重做</li>
                <li><kbd>Ctrl+C</kbd> 复制节点</li>
                <li><kbd>Ctrl+V</kbd> 粘贴节点</li>
                <li><kbd>Ctrl+A</kbd> 全选节点</li>
                <li><kbd>Ctrl+G</kbd> 编组选中的节点</li>
                <li><kbd>Delete</kbd> / <kbd>Backspace</kbd> 删除选中的节点</li>
                <li><kbd>Escape</kbd> 关闭弹窗/取消选择</li>
                <li><kbd>Ctrl+Enter</kbd> 开始生成</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>📌 节点操作</h4>
              <ul>
                <li>拖拽节点边缘的<strong>连接点</strong>来创建连线</li>
                <li>右键点击节点打开<strong>操作菜单</strong></li>
                <li>点击节点上的 <strong>+</strong> 快速添加下游节点</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 节点选择器弹窗 -->
      <NodeSelector 
        v-if="canvasStore.isNodeSelectorOpen"
        :position="canvasStore.nodeSelectorPosition"
        :trigger="canvasStore.nodeSelectorTrigger"
        :trigger-node-id="canvasStore.triggerNodeId"
        @close="canvasStore.closeNodeSelector()"
      />
      
      <!-- 节点右键菜单 -->
      <NodeContextMenu
        v-if="canvasStore.isContextMenuOpen"
        :position="canvasStore.contextMenuPosition"
        :node="canvasStore.contextMenuTargetNode"
        @close="canvasStore.closeContextMenu()"
      />
      
      <!-- 画布右键菜单（空白区域） -->
      <CanvasContextMenu
        v-if="canvasStore.isCanvasContextMenuOpen"
        :position="canvasStore.canvasContextMenuPosition"
        @close="canvasStore.closeCanvasContextMenu()"
        @upload="handleCanvasUpload"
        @add-node="handleCanvasAddNode"
      />
      
      <!-- 工作流模板面板 -->
      <WorkflowTemplates
        :visible="showTemplates"
        @close="closeTemplates"
        @select="closeTemplates"
      />
      
      <!-- 保存工作流对话框 -->
      <SaveWorkflowDialog
        :visible="showSaveDialog"
        @close="closeSaveDialog"
        @saved="handleWorkflowSaved"
      />
      
      <!-- 编组工具栏 -->
      <GroupToolbar
        v-if="showGroupToolbar"
        :group-node="selectedGroupNode"
        :position="groupToolbarPosition"
        :style="{
          position: 'fixed',
          left: `${groupToolbarPosition.x}px`,
          top: `${groupToolbarPosition.y}px`,
          transform: 'translateX(-50%)',
          zIndex: 9999
        }"
        @disband="handleDisbandGroup"
        @execute="handleExecuteGroup"
        @save-workflow="handleSaveWorkflow"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.canvas-page.is-transitioning {
  pointer-events: none;
}

/* 模式切换按钮 */
.mode-switch-btn {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.mode-switch-icon {
  width: 40px;
  height: 40px;
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.mode-switch-icon svg {
  width: 20px;
  height: 20px;
}

.mode-switch-btn:hover .mode-switch-icon {
  background: rgba(60, 60, 60, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* 模式切换弹窗 */
.mode-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 80px 0 0 80px;
  z-index: 1000;
}

.mode-popup {
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  width: 320px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
}

.mode-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-popup-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.mode-popup-close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.mode-popup-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.mode-popup-content {
  padding: 20px;
}

.mode-popup-content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.5;
}

.mode-popup-hint {
  margin-top: 8px !important;
  color: rgba(255, 255, 255, 0.5) !important;
  font-size: 13px !important;
}

.mode-popup-actions {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-popup-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-popup-btn.cancel {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
}

.mode-popup-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.mode-popup-btn.confirm {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  color: #1a1a1a;
}

.mode-popup-btn.confirm:hover {
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.popup-fade-enter-active,
.popup-fade-leave-active {
  transition: all 0.25s ease;
}

.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
}

.popup-fade-enter-from .mode-popup,
.popup-fade-leave-to .mode-popup {
  transform: scale(0.95) translateY(-10px);
}

/* 转场遮罩 */
.transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(ellipse at center, rgba(20, 20, 20, 0.98) 0%, rgba(0, 0, 0, 0.99) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.transition-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
}

.transition-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.page-transition-enter-active {
  animation: transitionIn 0.4s ease-out;
}

.page-transition-leave-active {
  animation: transitionOut 0.3s ease-in;
}

@keyframes transitionIn {
  from {
    opacity: 0;
    transform: scale(1.1);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes transitionOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.canvas-loading-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--canvas-bg-primary);
}

/* 帮助弹窗 */
.canvas-help-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.canvas-help-content {
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.canvas-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #3a3a3a;
}

.canvas-help-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.canvas-help-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #888888;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.canvas-help-close:hover {
  background: #2a2a2a;
  color: #ffffff;
}

.canvas-help-body {
  padding: 24px;
}

.help-section {
  margin-bottom: 24px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.help-section ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.help-section li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  color: #cccccc;
  font-size: 14px;
  border-bottom: 1px solid #2a2a2a;
}

.help-section li:last-child {
  border-bottom: none;
}

.help-section kbd {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  color: #ffffff;
  background: #333333;
  border: 1px solid #444444;
  border-radius: 6px;
  box-shadow: 0 2px 0 #222222;
}

.help-section strong {
  color: #ffffff;
}
</style>

