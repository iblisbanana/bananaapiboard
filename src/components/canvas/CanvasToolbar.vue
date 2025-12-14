<script setup>
/**
 * CanvasToolbar.vue - 左侧工具栏
 */
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useCanvasStore } from '@/stores/canvas'
import { saveWorkflowLocal } from '@/api/canvas/workflow'
import UserProfilePanel from './UserProfilePanel.vue'

const router = useRouter()
const canvasStore = useCanvasStore()
const userInfo = inject('userInfo')
const openTemplates = inject('openTemplates')

// 个人中心面板
const showProfilePanel = ref(false)
const profilePanelPosition = ref({ x: 80, y: 100 })

// 节点面板显示状态
const showNodePanel = ref(false)
const nodeMenuHoverTimer = ref(null)

// 节点类型列表
const nodeTypes = [
  {
    type: 'text-input',
    icon: 'T',
    label: '文本',
    tag: 'Gemini3',
    description: '脚本、广告词、品牌文案'
  },
  {
    type: 'image-input',
    icon: '🖼',
    label: '图片',
    tag: 'Banana Pro',
    description: null
  },
  {
    type: 'video-input',
    icon: '🎬',
    label: '视频',
    tag: null,
    description: null
  },
  {
    type: 'audio-input',
    icon: '🎵',
    label: '音频',
    tag: 'Beta',
    description: null
  }
]

// 鼠标进入+号按钮
function handleAddBtnMouseEnter() {
  if (nodeMenuHoverTimer.value) {
    clearTimeout(nodeMenuHoverTimer.value)
  }
  showNodePanel.value = true
}

// 鼠标离开+号按钮区域
function handleAddMenuMouseLeave() {
  nodeMenuHoverTimer.value = setTimeout(() => {
    showNodePanel.value = false
  }, 200)
}

// 鼠标进入节点面板
function handleNodePanelMouseEnter() {
  if (nodeMenuHoverTimer.value) {
    clearTimeout(nodeMenuHoverTimer.value)
  }
  showNodePanel.value = true
}

// 创建节点
function createNode(nodeType) {
  const position = {
    x: 300,
    y: window.innerHeight / 2 - 100
  }
  
  canvasStore.addNode({
    type: nodeType,
    position,
    data: {}
  })
  
  showNodePanel.value = false
}

// 打开文件上传
function handleUpload() {
  // 触发文件上传逻辑
  canvasStore.openNodeSelector(
    { x: 80, y: window.innerHeight / 2 - 100 },
    'toolbar'
  )
  showNodePanel.value = false
}

// 返回首页
function goHome() {
  router.push('/')
}

// 打开模板面板
function handleOpenTemplates() {
  if (openTemplates) {
    openTemplates()
  }
}

// 打开历史记录（跳转到工作流列表）
function openHistory() {
  router.push('/workflows')
}

// 打开保存对话框
const emit = defineEmits(['openSaveDialog'])

function saveWorkflow() {
  const data = canvasStore.exportWorkflow()
  if (data.nodes.length === 0) {
    alert('画布为空，无需保存')
    return
  }
  
  // 触发打开保存对话框
  emit('openSaveDialog')
}

// 计算总积分
function getTotalPoints() {
  if (!userInfo.value) return 0
  return (userInfo.value.package_points || 0) + (userInfo.value.points || 0)
}

// 打开个人中心面板
function openProfilePanel(event) {
  // 计算面板位置（在按钮右侧，靠近顶部）
  const btn = event.currentTarget
  const rect = btn.getBoundingClientRect()
  profilePanelPosition.value = {
    x: rect.right + 16,
    y: 80  // 固定在顶部附近
  }
  showProfilePanel.value = true
}

// 关闭个人中心面板
function closeProfilePanel() {
  showProfilePanel.value = false
}

// 刷新用户信息
function handleUserUpdate() {
  // 触发父组件刷新用户信息
  window.location.reload()
}
</script>

<template>
  <div class="canvas-toolbar">
    <!-- 添加节点按钮（主按钮） -->
    <div 
      class="add-node-container"
      @mouseenter="handleAddBtnMouseEnter"
      @mouseleave="handleAddMenuMouseLeave"
    >
      <button 
        class="canvas-toolbar-btn add-btn" 
        title="添加节点"
      >
        +
      </button>
      
      <!-- 节点选择面板 -->
      <div 
        v-if="showNodePanel"
        class="node-panel"
        @mouseenter="handleNodePanelMouseEnter"
        @mouseleave="handleAddMenuMouseLeave"
      >
        <div class="node-panel-title">添加节点</div>
        
        <!-- 节点类型列表 -->
        <div class="node-list">
          <div 
            v-for="node in nodeTypes" 
            :key="node.type"
            class="node-item"
            @click="createNode(node.type)"
          >
            <div class="node-icon">{{ node.icon }}</div>
            <div class="node-info">
              <div class="node-header">
                <span class="node-label">{{ node.label }}</span>
                <span v-if="node.tag" class="node-tag">{{ node.tag }}</span>
              </div>
              <div v-if="node.description" class="node-desc">{{ node.description }}</div>
            </div>
          </div>
        </div>
        
        <div class="node-panel-divider"></div>
        <div class="node-panel-title">添加资源</div>
        
        <!-- 上传选项 -->
        <div class="node-item" @click="handleUpload">
          <div class="node-icon">⬆</div>
          <div class="node-info">
            <div class="node-label">上传</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="canvas-toolbar-divider"></div>
    
    <!-- 工作流模板 -->
    <button 
      class="canvas-toolbar-btn icon-btn" 
      title="工作流模板"
      @click="handleOpenTemplates"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    </button>
    
    <!-- 历史记录 -->
    <button 
      class="canvas-toolbar-btn icon-btn" 
      title="历史记录"
      @click="openHistory"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    </button>
    
    <!-- 聊天/帮助 -->
    <button 
      class="canvas-toolbar-btn icon-btn" 
      title="帮助"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    
    <!-- 保存工作流 -->
    <button 
      class="canvas-toolbar-btn icon-btn" 
      title="保存工作流"
      @click="saveWorkflow"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
    </button>
    
    <div class="canvas-toolbar-divider"></div>
    
    <!-- 个人中心按钮 -->
    <button 
      class="canvas-toolbar-btn user-btn" 
      :title="`个人中心 | 积分: ${getTotalPoints()}`"
      @click="openProfilePanel"
    >
      {{ userInfo?.username?.charAt(0)?.toUpperCase() || 'P' }}
    </button>
    
    <!-- 个人中心面板 -->
    <UserProfilePanel
      :visible="showProfilePanel"
      :user-info="userInfo"
      :position="profilePanelPosition"
      @close="closeProfilePanel"
      @update="handleUserUpdate"
    />
  </div>
</template>

<style scoped>
.canvas-toolbar {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 50;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 12px 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.canvas-toolbar-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
  position: relative;
}

.canvas-toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

/* 添加节点容器 */
.add-node-container {
  position: relative;
}

.add-btn {
  width: 44px;
  height: 44px;
  background: white;
  color: #0a0a0a;
  border-radius: 12px;
  font-size: 28px;
  font-weight: 300;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.add-btn:hover {
  background: white;
  color: #0a0a0a;
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

/* 图标按钮 */
.icon-btn {
  font-size: 20px;
}

.icon-btn svg {
  stroke: rgba(255, 255, 255, 0.6);
}

.icon-btn:hover svg {
  stroke: rgba(255, 255, 255, 0.9);
}

/* 用户按钮 */
.user-btn {
  font-size: 16px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
}

.user-btn:hover {
  transform: scale(1.1);
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.1);
}

.canvas-toolbar-divider {
  width: 28px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px auto;
}

/* ========== 节点面板 ========== */
.node-panel {
  position: absolute;
  left: calc(100% + 12px);
  top: 0;
  width: 340px;
  background: rgba(30, 30, 30, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  animation: slideInFromLeft 0.2s ease;
  z-index: 100;
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.node-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  padding: 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.node-panel-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 12px 0;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.node-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.node-label {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.node-tag {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.node-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;
}
</style>

