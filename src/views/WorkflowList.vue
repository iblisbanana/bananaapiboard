<script setup>
/**
 * WorkflowList.vue - 工作流列表页面
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkflowList, deleteWorkflow, getStorageQuota } from '@/api/canvas/workflow'
import { useCanvasStore } from '@/stores/canvas'

const router = useRouter()
const canvasStore = useCanvasStore()

// 数据状态
const workflows = ref([])
const loading = ref(true)
const quota = ref(null)
const pagination = ref({
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 0
})

// 删除确认
const deleteConfirm = ref({
  visible: false,
  workflow: null
})

// 加载工作流列表
async function loadWorkflows() {
  loading.value = true
  try {
    const result = await getWorkflowList({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    
    workflows.value = result.list || []
    pagination.value = { ...pagination.value, ...result.pagination }
  } catch (error) {
    console.error('[WorkflowList] 加载失败:', error)
    alert('加载工作流列表失败：' + error.message)
  } finally {
    loading.value = false
  }
}

// 加载配额信息
async function loadQuota() {
  try {
    const result = await getStorageQuota()
    quota.value = result.quota
  } catch (error) {
    console.error('[WorkflowList] 加载配额失败:', error)
  }
}

// 打开工作流
function openWorkflow(workflow) {
  // 设置工作流元信息到store
  canvasStore.workflowMeta = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description
  }
  
  // 跳转到画布页面，画布页面会自动加载工作流
  router.push(`/canvas?load=${workflow.id}`)
}

// 新建工作流
function createNewWorkflow() {
  // 清空工作流元信息
  canvasStore.workflowMeta = null
  router.push('/canvas')
}

// 确认删除
function confirmDelete(workflow) {
  deleteConfirm.value = {
    visible: true,
    workflow
  }
}

// 取消删除
function cancelDelete() {
  deleteConfirm.value = {
    visible: false,
    workflow: null
  }
}

// 删除工作流
async function handleDelete() {
  if (!deleteConfirm.value.workflow) return
  
  try {
    await deleteWorkflow(deleteConfirm.value.workflow.id)
    
    // 重新加载列表
    await loadWorkflows()
    await loadQuota()
    
    cancelDelete()
  } catch (error) {
    console.error('[WorkflowList] 删除失败:', error)
    alert('删除失败：' + error.message)
  }
}

// 格式化时间
function formatDate(date) {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  
  return d.toLocaleDateString('zh-CN')
}

// 格式化存储大小
function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// 页面切换
function changePage(page) {
  pagination.value.page = page
  loadWorkflows()
}

// 初始化
onMounted(() => {
  loadWorkflows()
  loadQuota()
})
</script>

<template>
  <div class="workflow-list-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">我的工作流</h1>
        <p class="page-subtitle">管理您的创作工作流</p>
      </div>
      
      <button class="btn-new-workflow" @click="createNewWorkflow">
        <span class="btn-icon">+</span>
        新建工作流
      </button>
    </div>
    
    <!-- 配额卡片 -->
    <div v-if="quota" class="quota-card">
      <div class="quota-header">
        <span class="quota-title">存储使用情况</span>
        <span v-if="quota.is_vip" class="vip-badge">VIP</span>
      </div>
      
      <div class="quota-bar-container">
        <div class="quota-bar">
          <div 
            class="quota-bar-fill"
            :style="{ width: `${quota.used_percentage}%` }"
            :class="{
              'warning': quota.used_percentage > 80,
              'danger': quota.used_percentage > 95
            }"
          ></div>
        </div>
        <span class="quota-text">
          {{ formatSize(quota.used_storage) }} / {{ formatSize(quota.total_quota) }}
          ({{ quota.used_percentage }}%)
        </span>
      </div>
      
      <div class="quota-stats">
        <div class="quota-stat-item">
          <span class="stat-value">{{ quota.current_workflows }} / {{ quota.max_workflows }}</span>
          <span class="stat-label">工作流</span>
        </div>
        <div class="quota-stat-item">
          <span class="stat-value">{{ formatSize(quota.max_workflow_size) }}</span>
          <span class="stat-label">单个限制</span>
        </div>
        <div class="quota-stat-item">
          <span class="stat-value">{{ quota.total_generations }}</span>
          <span class="stat-label">总生成数</span>
        </div>
      </div>
    </div>
    
    <!-- 工作流列表 -->
    <div class="workflow-grid">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="workflows.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3 class="empty-title">还没有工作流</h3>
        <p class="empty-desc">创建您的第一个创作工作流</p>
        <button class="btn-create-first" @click="createNewWorkflow">
          创建工作流
        </button>
      </div>
      
      <!-- 工作流卡片 -->
      <div
        v-for="workflow in workflows"
        :key="workflow.id"
        class="workflow-card"
        @click="openWorkflow(workflow)"
      >
        <!-- 缩略图 -->
        <div class="workflow-thumbnail">
          <div class="thumbnail-placeholder">
            <span class="placeholder-icon">🎨</span>
          </div>
        </div>
        
        <!-- 信息 -->
        <div class="workflow-info">
          <h3 class="workflow-name">{{ workflow.name }}</h3>
          <p v-if="workflow.description" class="workflow-desc">
            {{ workflow.description }}
          </p>
          
          <!-- 统计 -->
          <div class="workflow-stats">
            <span class="stat-item">
              <span class="stat-icon">📦</span>
              {{ workflow.node_count }} 节点
            </span>
            <span class="stat-item">
              <span class="stat-icon">💾</span>
              {{ formatSize(workflow.storage_size) }}
            </span>
          </div>
          
          <!-- 底部 -->
          <div class="workflow-footer">
            <span class="workflow-time">{{ formatDate(workflow.updated_at) }}</span>
            
            <button
              class="btn-delete"
              @click.stop="confirmDelete(workflow)"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="pagination.page === 1"
        @click="changePage(pagination.page - 1)"
      >
        上一页
      </button>
      
      <span class="page-info">
        第 {{ pagination.page }} / {{ pagination.totalPages }} 页
      </span>
      
      <button
        class="page-btn"
        :disabled="pagination.page === pagination.totalPages"
        @click="changePage(pagination.page + 1)"
      >
        下一页
      </button>
    </div>
    
    <!-- 删除确认对话框 -->
    <div v-if="deleteConfirm.visible" class="dialog-overlay" @click.self="cancelDelete">
      <div class="dialog-container">
        <div class="dialog-header">
          <h2 class="dialog-title">确认删除</h2>
          <button class="dialog-close" @click="cancelDelete">✕</button>
        </div>
        
        <div class="dialog-content">
          <p>确定要删除工作流 "{{ deleteConfirm.workflow?.name }}" 吗？</p>
          <p class="warning-text">此操作无法撤销</p>
        </div>
        
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="cancelDelete">取消</button>
          <button class="btn btn-danger" @click="handleDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-list-page {
  min-height: 100vh;
  background: #0a0a0a;
  padding: 40px 20px;
}

/* 头部 */
.page-header {
  max-width: 1200px;
  margin: 0 auto 32px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-left {
  flex: 1;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
}

.page-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.btn-new-workflow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-new-workflow:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.btn-icon {
  font-size: 20px;
  font-weight: 300;
}

/* 配额卡片 */
.quota-card {
  max-width: 1200px;
  margin: 0 auto 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
}

.quota-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.quota-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.vip-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: #000;
}

.quota-bar-container {
  margin-bottom: 16px;
}

.quota-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.quota-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.quota-bar-fill.warning {
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.quota-bar-fill.danger {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.quota-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.quota-stats {
  display: flex;
  gap: 32px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.quota-stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 工作流网格 */
.workflow-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* 加载状态 */
.loading-container {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 24px;
}

.btn-create-first {
  padding: 12px 32px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create-first:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

/* 工作流卡片 */
.workflow-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.workflow-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  border-color: rgba(59, 130, 246, 0.5);
}

.workflow-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #1e293b, #334155);
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 48px;
  opacity: 0.3;
}

.workflow-info {
  padding: 16px;
}

.workflow-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  min-height: 36px;
}

.workflow-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-icon {
  font-size: 14px;
}

.workflow-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.workflow-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.btn-delete {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* 分页 */
.pagination {
  max-width: 1200px;
  margin: 40px auto 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.page-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  width: 90%;
  max-width: 400px;
  background: #1a1a1a;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dialog-content {
  padding: 24px;
}

.dialog-content p {
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 16px;
  font-size: 15px;
}

.warning-text {
  color: #ef4444;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}
</style>


