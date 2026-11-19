export const TREE_VIEWS = [
  'ancestor',
  'descendant',
  'hourglass',
  'relationship',
  'fan',
  'connection',
]

export const DEFAULT_TREE_VIEW = 'ancestor'

export function getTreeViewTabIndex(view) {
  const index = TREE_VIEWS.indexOf(view)
  if (index !== -1) {
    return index
  }
  return TREE_VIEWS.indexOf(DEFAULT_TREE_VIEW)
}

// The app path of the tree view showing `grampsId` in `chart`, without the
// person when there is none. A chart of two people, the connection chart,
// also has the second person, `other`.
export function treeViewPath(chart, grampsId, other = '') {
  return ['tree', chart, grampsId, grampsId && other].filter(Boolean).join('/')
}
