<script setup>
/**
 * WorkflowTemplates.vue - 工作流模板选择面板
 */
import { ref, computed, onMounted } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { getWorkflowTemplates } from '@/api/canvas/workflow'
import { useI18n } from '@/i18n'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close', 'select'])
const canvasStore = useCanvasStore()
const { t } = useI18n()

const templates = ref([])
const loading = ref(true)
const selectedCategory = ref('all')

// 分类（使用 computed 以支持语言切换）
const categories = computed(() => [
  { key: 'all', label: t('canvas.categories.all') },
  { key: 'basic', label: t('canvas.categories.basic') },
  { key: 'advanced', label: t('canvas.categories.advanced') },
  { key: 'video', label: t('canvas.categories.video') }
])

// 过滤后的模板
const filteredTemplates = computed(() => {
  if (selectedCategory.value === 'all') {
    return templates.value
  }
  return templates.value.filter(t => t.category === selectedCategory.value)
})

// 加载模板
async function loadTemplates() {
  loading.value = true
  try {
    const data = await getWorkflowTemplates()
    templates.value = data.templates || []
  } catch (e) {
    console.error('加载模板失败:', e)
    // 使用内置模板
    templates.value = getBuiltinTemplates()
  } finally {
    loading.value = false
  }
}

// 内置模板（离线可用）
function getBuiltinTemplates() {
  return [
    {
      id: 'tpl-quick-image',
      name: t('canvas.templates.quickImage.name'),
      description: t('canvas.templates.quickImage.desc'),
      icon: '🎨',
      category: 'basic',
      nodes: [
        { id: 'n1', type: 'text-input', position: { x: 100, y: 200 }, data: { title: t('canvas.templates.nodeTitle.inputPrompt') } },
        { id: 'n2', type: 'text-to-image', position: { x: 400, y: 200 }, data: { title: t('canvas.templates.nodeTitle.generateImage') } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
    },
    {
      id: 'tpl-prompt-enhance',
      name: t('canvas.templates.promptEnhance.name'),
      description: t('canvas.templates.promptEnhance.desc'),
      icon: '✨',
      category: 'advanced',
      nodes: [
        { id: 'n1', type: 'text-input', position: { x: 100, y: 200 }, data: { title: t('canvas.templates.nodeTitle.inputIdea') } },
        { id: 'n2', type: 'llm-prompt-enhance', position: { x: 350, y: 200 }, data: { title: t('canvas.templates.nodeTitle.promptOptimize'), type: 'llm-prompt-enhance' } },
        { id: 'n3', type: 'text-to-image', position: { x: 600, y: 200 }, data: { title: t('canvas.templates.nodeTitle.generateImage') } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }]
    },
    {
      id: 'tpl-image-to-video',
      name: t('canvas.templates.imageToVideo.name'),
      description: t('canvas.templates.imageToVideo.desc'),
      icon: '🎥',
      category: 'video',
      nodes: [
        { id: 'n1', type: 'image-input', position: { x: 100, y: 200 }, data: { title: t('canvas.templates.nodeTitle.uploadImage') } },
        { id: 'n2', type: 'image-to-video', position: { x: 400, y: 200 }, data: { title: t('canvas.templates.nodeTitle.generateVideo') } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
    },
    {
      id: 'tpl-text-to-video',
      name: t('canvas.templates.textToVideo.name'),
      description: t('canvas.templates.textToVideo.desc'),
      icon: '📹',
      category: 'video',
      nodes: [
        { id: 'n1', type: 'text-input', position: { x: 100, y: 200 }, data: { title: t('canvas.templates.nodeTitle.inputDescription') } },
        { id: 'n2', type: 'text-to-video', position: { x: 400, y: 200 }, data: { title: t('canvas.templates.nodeTitle.generateVideo') } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
    },
    {
      id: 'tpl-style-transfer',
      name: t('canvas.templates.styleTransfer.name'),
      description: t('canvas.templates.styleTransfer.desc'),
      icon: '🔄',
      category: 'advanced',
      nodes: [
        { id: 'n1', type: 'image-input', position: { x: 100, y: 200 }, data: { title: t('canvas.templates.nodeTitle.referenceImage') } },
        { id: 'n2', type: 'llm-image-describe', position: { x: 350, y: 200 }, data: { title: t('canvas.templates.nodeTitle.imageDescription'), type: 'llm-image-describe' } },
        { id: 'n3', type: 'text-to-image', position: { x: 600, y: 200 }, data: { title: t('canvas.templates.nodeTitle.styleGenerate') } }
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }]
    }
  ]
}

// 应用模板
function applyTemplate(template) {
  // 清空当前画布
  canvasStore.clearCanvas()
  
  // 为节点生成新的唯一 ID
  const idMap = {}
  const newNodes = template.nodes.map(node => {
    const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    idMap[node.id] = newId
    return {
      ...node,
      id: newId,
      data: { ...node.data, status: 'idle' }
    }
  })
  
  // 更新连线的 source/target
  const newEdges = template.edges.map(edge => ({
    ...edge,
    id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source: idMap[edge.source],
    target: idMap[edge.target]
  }))
  
  // 加载工作流
  canvasStore.loadWorkflow({
    nodes: newNodes,
    edges: newEdges
  })
  
  emit('select', template)
  emit('close')
}

// 关闭面板
function handleClose() {
  emit('close')
}

// 阻止点击冒泡
function handlePanelClick(event) {
  event.stopPropagation()
}

onMounted(() => {
  loadTemplates()
})
</script>

<template>
  <div class="templates-overlay" v-if="visible" @click="handleClose">
    <div class="templates-panel" @click="handlePanelClick">
      <!-- 头部 -->
      <div class="templates-header">
        <h2 class="templates-title">📋 {{ t('canvas.templates.title') }}</h2>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <!-- 分类标签 -->
      <div class="templates-categories">
        <button 
          v-for="cat in categories" 
          :key="cat.key"
          class="category-btn"
          :class="{ active: selectedCategory === cat.key }"
          @click="selectedCategory = cat.key"
        >
          {{ cat.label }}
        </button>
      </div>
      
      <!-- 模板列表 -->
      <div class="templates-list">
        <div v-if="loading" class="templates-loading">
          <div class="canvas-loading-spinner"></div>
          <span>{{ t('canvas.templates.loading') }}</span>
        </div>
        
        <div 
          v-else
          v-for="template in filteredTemplates" 
          :key="template.id"
          class="template-card"
          @click="applyTemplate(template)"
        >
          <div class="template-icon">{{ template.icon || '📄' }}</div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
            <div class="template-meta">
              <span class="node-count">{{ t('canvas.templates.nodeCount', { count: template.nodes?.length || 0 }) }}</span>
            </div>
          </div>
        </div>
        
        <div v-if="!loading && filteredTemplates.length === 0" class="templates-empty">
          {{ t('canvas.templates.noTemplates') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.templates-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.templates-panel {
  background: var(--canvas-bg-secondary);
  border: 1px solid var(--canvas-border-subtle);
  border-radius: var(--canvas-radius-xl);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--canvas-border-subtle);
}

.templates-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--canvas-text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--canvas-text-secondary);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--canvas-bg-elevated);
  color: var(--canvas-text-primary);
}

.templates-categories {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--canvas-border-subtle);
}

.category-btn {
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--canvas-bg-tertiary);
  border: 1px solid var(--canvas-border-subtle);
  color: var(--canvas-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  border-color: var(--canvas-border-active);
  color: var(--canvas-text-primary);
}

.category-btn.active {
  background: var(--canvas-accent-primary);
  border-color: var(--canvas-accent-primary);
  color: white;
}

.templates-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.templates-loading,
.templates-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--canvas-text-tertiary);
}

.template-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--canvas-bg-tertiary);
  border: 1px solid var(--canvas-border-subtle);
  border-radius: var(--canvas-radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: var(--canvas-accent-primary);
  background: var(--canvas-bg-elevated);
}

.template-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--canvas-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--canvas-text-primary);
  margin-bottom: 4px;
}

.template-desc {
  font-size: 12px;
  color: var(--canvas-text-tertiary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.template-meta {
  display: flex;
  gap: 12px;
}

.node-count {
  font-size: 11px;
  color: var(--canvas-text-tertiary);
  background: var(--canvas-bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>

