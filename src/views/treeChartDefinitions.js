import {html} from 'lit'

import '@material/web/chips/assist-chip'
import '@material/web/chips/input-chip'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/menu/menu'
import '@material/web/menu/menu-item'
import {mdiAccountArrowRight, mdiPalette} from '@mdi/js'

import '../components/GrampsjsFanChart.js'
import '../components/GrampsjsFormSelectObject.js'
import '../components/GrampsjsIcon.js'
import '../components/GrampsjsRelationshipChart.js'
import '../components/GrampsjsTooltip.js'
import '../components/GrampsjsTreeChart.js'
import {FamilyGraph} from '../charts/model/FamilyGraph.js'
import {formatChartName} from '../charts/util.js'
import {chartNameDisplayFormat, menuSelectionHandler} from '../util.js'

// A chart definition describes one chart of the tree view:
// - `settings`: the settings in the settings dialog. Each is stored in the
//   user settings under `key` and has a `name` in the setting values, a
//   `label`, a `type` and a `default`. A 'number' setting can have a `min`
//   and a `max`;
//   a 'select' setting has `options`, each with a `value` and a `label`.
// - `editable`: whether people can be added to the chart in edit mode.
// - `zoomable`: whether the chart has zoom and pan controls and keys.
// - `exportable`: whether the chart can be downloaded as an SVG file. Its
//   component returns the file from `svgDocument()`.
// - `request(grampsId, values, branches)`: the filter rules and extensions
//   of the people the chart needs. In tree charts, `branches` lists the
//   people whose branches show one more generation, each with its `grampsId`
//   and `direction`, 'ancestors' or 'descendants'.
// - `render({grampsId, values, data, canEdit, appState, state, expanded})`:
//   the chart component. `state` holds options that are not stored, such as
//   the fan chart colour, and `expanded` the handles of the people whose
//   branches show one more generation.
// - `renderControls(view)`, optional: controls after the common ones.
// - `dataKey(grampsId, values, lang, state)` and
//   `load(appState, grampsId, values, lang, state)`, optional: for a chart
//   whose people are not one filtered list. `load` fetches them and returns
//   `{data}`, optionally with `info` for the controls, or `{error}`. It runs
//   when the key changes; an empty key means there is nothing to fetch.
//
// Generation settings count the generations beyond the selected person.
// Chart components and filter rules also count the selected person's
// generation.

const treeExtend = 'event_ref_list,primary_parent_family,family_list'

const ancestorRule = (grampsId, generations) => ({
  name: 'IsLessThanNthGenerationAncestorOf',
  values: [grampsId, generations],
})

const descendantRule = (grampsId, generations) => ({
  name: 'IsLessThanNthGenerationDescendantOf',
  values: [grampsId, generations],
})

// The person and their parents or children, for a branch that shows one
// more generation
const branchRule = ({grampsId, direction}) =>
  direction === 'ancestors'
    ? ancestorRule(grampsId, 2)
    : descendantRule(grampsId, 2)

// Filter rules for the ancestors and descendants of a person, and for the
// parents or children of the people in `branches`
function treeRules(
  grampsId,
  ancestorGenerations,
  descendantGenerations,
  branches = []
) {
  return {
    function: 'or',
    rules: [
      ancestorRule(grampsId, ancestorGenerations),
      descendantRule(grampsId, descendantGenerations),
      ...branches.map(branchRule),
    ],
  }
}

const nameDisplayFormatSetting = key => ({
  name: 'nameDisplayFormat',
  key,
  label: 'Name Display Format',
  type: 'select',
  options: Object.values(chartNameDisplayFormat).map(format => ({
    value: format,
    label: format,
  })),
  default: chartNameDisplayFormat.surnameThenGiven,
})

// Whether generations run in columns or in rows, with ancestors above. As
// in Gramps, the arrows point where the chart grows: towards the ancestors,
// or for a chart of descendants only, towards them.
const orientationSetting = (key, {descendants = false} = {}) => ({
  name: 'orientation',
  key,
  label: 'Tree direction',
  type: 'select',
  options: [
    {
      value: 'horizontal',
      label: descendants ? 'Horizontal (←)' : 'Horizontal (→)',
    },
    {value: 'vertical', label: descendants ? 'Vertical (↓)' : 'Vertical (↑)'},
  ],
  default: 'horizontal',
})

const ancestorsSetting = (key, defaultValue) => ({
  name: 'ancestors',
  key,
  label: 'Max Ancestor Generations',
  type: 'number',
  min: 1,
  default: defaultValue,
})

const descendantsSetting = (key, defaultValue) => ({
  name: 'descendants',
  key,
  label: 'Max Descendant Generations',
  type: 'number',
  min: 1,
  default: defaultValue,
})

const fanColors = {
  nEvents: 'Number of events',
  nNotes: 'Number of notes',
  birthYear: 'Birth year',
  deathYear: 'Death year',
  age: 'Age',
  surname: 'Surname',
  religion: 'Religion',
  nPaths: 'Ancestor frequency',
}

// The colour control of the fan chart: a palette button that opens the menu of
// colours or, once a colour is chosen, a chip with that colour that opens the
// menu and can be removed
function renderFanColorControls(view) {
  const {color} = view.chartState
  const setColor = value => view.setChartState({color: value})
  const openMenu = () => {
    view.renderRoot.querySelector('#usage-menu').open = true
  }
  const control =
    color && fanColors[color]
      ? html`
          <md-input-chip
            id="btn-color"
            label="${view._(fanColors[color])}"
            @click=${openMenu}
            @remove=${e => {
              // The chip is replaced by the palette button on the next
              // render, so it does not remove itself
              e.preventDefault()
              setColor('')
            }}
          >
            <svg viewBox="0 0 24 24" slot="icon">
              <path d="${mdiPalette}" />
            </svg>
          </md-input-chip>
        `
      : html`
          <md-icon-button
            @click=${openMenu}
            aria-label="${view._('Color')}"
            id="btn-color"
          >
            <grampsjs-icon
              path="${mdiPalette}"
              color="currentColor"
            ></grampsjs-icon>
          </md-icon-button>
        `
  return html`
    ${control}
    <grampsjs-tooltip for="btn-color" .appState="${view.appState}"
      >${view._('Color')}</grampsjs-tooltip
    >
    <span style="position: relative">
      <md-menu
        id="usage-menu"
        anchor="btn-color"
        positioning="popover"
        skip-restore-focus
        @close-menu=${menuSelectionHandler(item =>
          setColor(item.dataset.value)
        )}
      >
        ${Object.keys(fanColors).map(
          value => html`
            <md-menu-item data-value="${value}">
              <div slot="headline">${view._(fanColors[value])}</div>
            </md-menu-item>
          `
        )}
      </md-menu>
    </span>
  `
}

// The handle of the person with `grampsId`, or undefined
async function personHandle(appState, grampsId) {
  const result = await appState.apiGet(
    `/api/people/?gramps_id=${encodeURIComponent(grampsId)}&keys=handle`
  )
  return result.data?.[0]?.handle
}

// Whether a path goes down to a child, across any of the child's siblings and
// up to a parent, which only says again that the two parents are partners. A
// step's `link` is how its person is linked to the person before them.
function throughSharedChild({steps}) {
  let down = false
  for (const {link} of steps) {
    if (link === 'parent' && down) {
      return true
    }
    if (link !== 'sibling') {
      down = link === 'child'
    }
  }
  return false
}

// Whether a path is just the marriage of the two people. A path never visits
// a person twice, so no longer path runs through that marriage.
const isTheirMarriage = path =>
  path.steps.length === 2 && path.steps[1].link === 'spouse'

// The people connecting the selected person and the second person in
// `state.other`: those on the shortest chains of family links, which also run
// through partners, and those on the blood relationship, up to a common
// ancestor and down again. The shortest chain of a married couple is their
// marriage, which would otherwise hide that they are also cousins, say.
// `info.relationships` are the relationships of the second person to the
// selected one along these chains, without the ones that have no name, such
// as a chain through two marriages. With `ignoreMarriage`, a marriage of the
// two people is left out, so that the chains after it are shown instead.
async function loadConnection(
  appState,
  grampsId,
  {paths, ignoreMarriage},
  lang,
  state
) {
  const [handle1, handle2] = await Promise.all([
    personHandle(appState, grampsId),
    personHandle(appState, state.other),
  ])
  if (!handle1 || !handle2) {
    return {data: [], info: {}}
  }
  const url = `/api/relations/${handle1}/${handle2}/paths?locale=${lang}`
  const [shortest, blood] = await Promise.all([
    // As many as the API gives, for the ones that are left out: a couple
    // with three children has fifteen paths through them
    appState.apiGet(`${url}&max=50`),
    appState.apiGet(`${url}&max=1&blood_only=true`),
  ])
  for (const result of [shortest, blood]) {
    if (!('data' in result)) {
      return result
    }
  }
  const found = [
    ...shortest.data
      .filter(
        path =>
          !throughSharedChild(path) &&
          !(ignoreMarriage === 'yes' && isTheirMarriage(path))
      )
      .slice(0, paths),
    ...blood.data,
  ]
  if (found.length === 0) {
    return {data: [], info: {notConnected: true}}
  }
  const handles = [
    ...new Set(found.flatMap(path => path.steps.map(s => s.handle))),
  ]
  const relationships = [
    ...new Set(
      found.map(path => path.steps.at(-1).relationship_string).filter(Boolean)
    ),
  ]
  const fetchPeople = list =>
    appState.apiGet(
      `/api/people/?handles=${list.join(
        ','
      )}&locale=${lang}&profile=self&extend=${treeExtend},parent_family_list`
    )
  const people = await fetchPeople(handles)
  if (!('data' in people)) {
    return people
  }
  const parents = missingParents(found, people.data)
  if (parents.length === 0) {
    return {data: people.data, info: {relationships}}
  }
  const more = await fetchPeople(parents)
  if (!('data' in more)) {
    return more
  }
  return {data: [...people.data, ...more.data], info: {relationships}}
}

// The handles of the parents in the families that the links of the paths run
// through and that are not in `people` yet: both parents two siblings share,
// whom a sibling link skips although they are the common ancestors, and the
// other parent of a parent or child link, so that the chart shows couples.
function missingParents(paths, people) {
  const graph = new FamilyGraph(people)
  const handles = new Set()
  // The parent family of `child` that `matches`
  const familyOf = (child, matches) => graph.parentFamilies(child).find(matches)
  const hasParent = parent => family =>
    family.father_handle === parent || family.mother_handle === parent
  const hasChild = child => family =>
    (family.child_ref_list ?? []).some(ref => ref.ref === child)
  for (const {steps} of paths) {
    steps.forEach((step, i) => {
      const before = steps[i - 1]?.handle
      let family
      if (step.link === 'sibling') {
        family = familyOf(before, hasChild(step.handle))
      } else if (step.link === 'parent') {
        family = familyOf(before, hasParent(step.handle))
      } else if (step.link === 'child') {
        family = familyOf(step.handle, hasParent(before))
      }
      for (const parent of [family?.father_handle, family?.mother_handle]) {
        if (parent && !graph.person(parent)) {
          handles.add(parent)
        }
      }
    })
  }
  return [...handles]
}

// The second person of the connection chart, as a chip that opens the person
// picker, and their relationship to the selected person
function renderConnectionControls(view) {
  // The selected person is no second person
  const other =
    view.chartState.other !== view.grampsId ? view.chartState.other : ''
  const person = other && view.chartData.find(p => p.gramps_id === other)
  let label = view._('Select a second person')
  if (person?.profile) {
    label = formatChartName(
      person.profile,
      view.settingValues.nameDisplayFormat
    )
  } else if (other) {
    label = other
  }
  const {relationships = [], notConnected} = view.chartInfo
  let text = ''
  if (notConnected) {
    text = view._('No connection found')
  } else if (person) {
    text = relationships.join(' · ')
  }
  return html`
    <md-assist-chip
      id="btn-connection-person"
      label="${label}"
      @click=${() =>
        view.renderRoot.querySelector('#connection-person-select')?.open()}
    >
      <grampsjs-icon
        slot="icon"
        path="${mdiAccountArrowRight}"
        color="currentColor"
      ></grampsjs-icon>
    </md-assist-chip>
    ${text ? html`<span class="connection-relationship">${text}</span>` : ''}
    <grampsjs-form-select-object
      id="connection-person-select"
      objectType="person"
      .appState="${view.appState}"
      fixedMenuPosition
      hideButton
      @select-object:changed=${e => {
        e.stopPropagation()
        const grampsId = e.detail.objects[0]?.object?.gramps_id
        if (grampsId) {
          view.setOtherPerson(grampsId)
        }
      }}
    ></grampsjs-form-select-object>
  `
}

export const chartDefinitions = {
  ancestor: {
    settings: [
      ancestorsSetting('treeChartAnc', 3),
      orientationSetting('treeChartOrientation'),
      nameDisplayFormatSetting('treeChartNameDisplayFormat'),
    ],
    editable: true,
    zoomable: true,
    exportable: true,
    request: (grampsId, {ancestors}, branches) => ({
      rules: treeRules(grampsId, ancestors + 1, 2, branches),
      extend: treeExtend,
    }),
    render: ({grampsId, values, data, canEdit, appState, expanded}) => html`
      <grampsjs-tree-chart
        ancestors
        grampsId=${grampsId}
        nAnc=${values.ancestors + 1}
        nDesc="2"
        ?vertical=${values.orientation === 'vertical'}
        nameDisplayFormat=${values.nameDisplayFormat}
        ?canEdit="${canEdit}"
        .data=${data}
        .expanded=${expanded}
        .appState="${appState}"
      >
      </grampsjs-tree-chart>
    `,
  },

  descendant: {
    settings: [
      descendantsSetting('descendantChartDesc', 1),
      orientationSetting('descendantChartOrientation', {descendants: true}),
      nameDisplayFormatSetting('descendantChartNameDisplayFormat'),
    ],
    editable: true,
    zoomable: true,
    exportable: true,
    request: (grampsId, {descendants}, branches) => ({
      rules: treeRules(grampsId, 2, descendants + 1, branches),
      extend: treeExtend,
    }),
    render: ({grampsId, values, data, canEdit, appState, expanded}) => html`
      <grampsjs-tree-chart
        descendants
        grampsId=${grampsId}
        nAnc="2"
        nDesc=${values.descendants + 1}
        ?vertical=${values.orientation === 'vertical'}
        nameDisplayFormat=${values.nameDisplayFormat}
        ?canEdit="${canEdit}"
        .data=${data}
        .expanded=${expanded}
        gapX="60"
        .appState="${appState}"
      >
      </grampsjs-tree-chart>
    `,
  },

  hourglass: {
    settings: [
      ancestorsSetting('hourglassChartAnc', 2),
      descendantsSetting('hourglassChartDesc', 1),
      orientationSetting('hourglassChartOrientation'),
      nameDisplayFormatSetting('hourglassChartNameDisplayFormat'),
    ],
    editable: true,
    zoomable: true,
    exportable: true,
    request: (grampsId, {ancestors, descendants}, branches) => ({
      rules: treeRules(grampsId, ancestors + 1, descendants + 1, branches),
      extend: treeExtend,
    }),
    render: ({grampsId, values, data, canEdit, appState, expanded}) => html`
      <grampsjs-tree-chart
        ancestors
        descendants
        grampsId=${grampsId}
        nAnc=${values.ancestors + 1}
        nDesc=${values.descendants + 1}
        ?vertical=${values.orientation === 'vertical'}
        nameDisplayFormat=${values.nameDisplayFormat}
        ?canEdit="${canEdit}"
        .data=${data}
        .expanded=${expanded}
        gapX="60"
        .appState="${appState}"
      >
      </grampsjs-tree-chart>
    `,
  },

  relationship: {
    settings: [
      {
        name: 'separation',
        key: 'relationshipChartAnc',
        label: 'Max Degree of Separation',
        type: 'number',
        min: 0,
        default: 2,
      },
      nameDisplayFormatSetting('relationshipChartNameDisplayFormat'),
    ],
    editable: true,
    zoomable: true,
    exportable: true,
    request: (grampsId, {separation}) => ({
      rules: {
        function: 'or',
        rules: [{name: 'DegreesOfSeparation', values: [grampsId, separation]}],
      },
      // The chart also shows other parent families, such as adoptive parents
      extend: `${treeExtend},parent_family_list`,
    }),
    render: ({grampsId, values, data, canEdit, appState}) => html`
      <grampsjs-relationship-chart
        grampsId=${grampsId}
        nameDisplayFormat=${values.nameDisplayFormat}
        ?canEdit="${canEdit}"
        .data=${data}
        .appState="${appState}"
      >
      </grampsjs-relationship-chart>
    `,
  },

  fan: {
    settings: [
      ancestorsSetting('fanChartAnc', 4),
      nameDisplayFormatSetting('fanChartNameDisplayFormat'),
    ],
    editable: false,
    zoomable: true,
    exportable: true,
    request: (grampsId, {ancestors}) => ({
      rules: treeRules(grampsId, ancestors + 1, 2),
      extend: treeExtend,
    }),
    render: ({grampsId, values, data, appState, state}) => html`
      <grampsjs-fan-chart
        grampsId=${grampsId}
        depth=${values.ancestors + 1}
        .data=${data}
        .appState="${appState}"
        color="${state.color ?? ''}"
        nameDisplayFormat=${values.nameDisplayFormat}
      >
      </grampsjs-fan-chart>
    `,
    renderControls: renderFanColorControls,
  },

  // How the selected person and a second person are connected. The second
  // person is in the URL and starts as the home person.
  connection: {
    settings: [
      {
        name: 'paths',
        key: 'connectionChartPaths',
        label: 'Max number of paths',
        type: 'number',
        min: 1,
        default: 1,
      },
      {
        name: 'ignoreMarriage',
        key: 'connectionChartIgnoreMarriage',
        label: 'Ignore their marriage',
        type: 'select',
        options: [
          {value: 'no', label: 'No'},
          {value: 'yes', label: 'Yes'},
        ],
        default: 'no',
      },
      nameDisplayFormatSetting('connectionChartNameDisplayFormat'),
    ],
    editable: false,
    zoomable: true,
    exportable: true,
    dataKey: (grampsId, {paths, ignoreMarriage}, lang, {other}) =>
      other && other !== grampsId
        ? `connection:${grampsId}:${other}:${paths}:${ignoreMarriage}:${lang}`
        : '',
    load: loadConnection,
    render: ({grampsId, values, data, appState, state}) => html`
      <grampsjs-relationship-chart
        grampsId=${grampsId}
        highlightGrampsId=${state.other ?? ''}
        nameDisplayFormat=${values.nameDisplayFormat}
        .data=${data}
        .appState="${appState}"
      >
      </grampsjs-relationship-chart>
    `,
    renderControls: renderConnectionControls,
  },
}

// Returns a number setting's value raised to its minimum
export function clampSettingValue(setting, value) {
  return setting.min === undefined ? value : Math.max(value, setting.min)
}

// Returns the values of a chart's settings by name, from the user settings or
// the defaults
export function chartSettingValues(definition, settings = {}) {
  return Object.fromEntries(
    definition.settings.map(setting => {
      const value = settings[setting.key] ?? setting.default
      // A stored value outside the limits counts as the nearest limit
      return [
        setting.name,
        setting.type === 'number' ? clampSettingValue(setting, value) : value,
      ]
    })
  )
}

// Returns the API URL of the people a chart needs
export function chartDataUrl(definition, grampsId, values, lang, branches) {
  const {rules, extend} = definition.request(grampsId, values, branches)
  return `/api/people/?rules=${encodeURIComponent(
    JSON.stringify(rules)
  )}&locale=${lang || 'en'}&profile=self&extend=${extend}`
}
