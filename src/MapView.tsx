import { useEffect, useMemo, useState } from 'react'
import { fetchMap, type MapEdge, type MapNode, type MapPayload } from './api'
import type { LifeArea } from './wins'

type PositionedNode = MapNode & {
  x: number
  y: number
  vx: number
  vy: number
}

type TooltipState = {
  node: MapNode
  clientX: number
  clientY: number
} | null

const MAP_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

function nodeRadius(node: MapNode): number {
  if (node.kind === 'area') return 7.6
  if (node.kind === 'goal') return 4.4
  return Math.min(3.4, Math.max(2.1, 1.8 + node.count * 0.38))
}

function initialPosition(node: MapNode, index: number, total: number): PositionedNode {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
  const areaIndex = node.kind === 'area' ? MAP_AREAS.indexOf(node.area) : MAP_AREAS.indexOf(node.area)
  const areaAngle = (areaIndex / MAP_AREAS.length) * Math.PI * 2 - Math.PI / 2
  const baseRadius = node.kind === 'area' ? 18 : node.kind === 'goal' ? 27 : 34
  const finalAngle = node.kind === 'area' ? angle : areaAngle + (index % 5 - 2) * 0.18
  return {
    ...node,
    x: 50 + Math.cos(finalAngle) * baseRadius,
    y: 50 + Math.sin(finalAngle) * baseRadius,
    vx: 0,
    vy: 0,
  }
}

function simulateForceLayout(nodes: MapNode[], edges: MapEdge[], iterations = 120): PositionedNode[] {
  const positioned = nodes.map((node, index) => initialPosition(node, index, nodes.length))
  const nodeById = new Map(positioned.map((node) => [node.id, node]))

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let leftIndex = 0; leftIndex < positioned.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < positioned.length; rightIndex++) {
        const left = positioned[leftIndex]
        const right = positioned[rightIndex]
        const dx = left.x - right.x || 0.01
        const dy = left.y - right.y || 0.01
        const distanceSquared = Math.max(10, dx * dx + dy * dy)
        const force = 16 / distanceSquared
        left.vx += dx * force
        left.vy += dy * force
        right.vx -= dx * force
        right.vy -= dy * force
      }
    }

    for (const edge of edges) {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target) continue
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const preferredDistance = edge.kind === 'area-goal' ? 18 : edge.kind === 'goal-cluster' ? 11 : 25
      const force = (distance - preferredDistance) * 0.012
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      source.vx += fx
      source.vy += fy
      target.vx -= fx
      target.vy -= fy
    }

    for (const node of positioned) {
      const centeringStrength = node.kind === 'area' ? 0.018 : node.kind === 'goal' ? 0.008 : 0.004
      node.vx += (50 - node.x) * centeringStrength
      node.vy += (50 - node.y) * centeringStrength
      node.vx *= 0.82
      node.vy *= 0.82
      node.x = Math.min(94, Math.max(6, node.x + node.vx))
      node.y = Math.min(94, Math.max(6, node.y + node.vy))
    }
  }

  return positioned
}

function tooltipText(node: MapNode): string {
  if (node.kind === 'area') return node.label
  if (node.kind === 'goal') return `${node.title} - ${node.status}, due ${node.targetDate}`
  return `${node.week}: ${node.count} win${node.count !== 1 ? 's' : ''}`
}

type MapViewProps = {
  onOpenGoals: () => void
}

export function MapView({ onOpenGoals }: MapViewProps) {
  const [mapPayload, setMapPayload] = useState<MapPayload | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [highlightedArea, setHighlightedArea] = useState<LifeArea | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchMap()
      .then((payload) => {
        if (cancelled) return
        setMapPayload(payload)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'Map failed to load.')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeGoalCount = mapPayload?.nodes.filter((node) => node.kind === 'goal' && node.status === 'active').length ?? 0
  const displayedNodes = useMemo(() => {
    if (!mapPayload) return []
    return activeGoalCount < 2 ? mapPayload.nodes.filter((node) => node.kind === 'area') : mapPayload.nodes
  }, [activeGoalCount, mapPayload])
  const displayedEdges = activeGoalCount < 2 ? [] : mapPayload?.edges ?? []
  const positionedNodes = useMemo(
    () => simulateForceLayout(displayedNodes, displayedEdges),
    [displayedEdges, displayedNodes],
  )
  const positionedNodeById = new Map(positionedNodes.map((node) => [node.id, node]))

  if (loadState === 'loading') {
    return (
      <div className="map-empty">
        <p>Drawing your life map.</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="map-empty">
        <p>{errorMessage}</p>
      </div>
    )
  }

  const isEmptyState = activeGoalCount < 2

  return (
    <div className="map-container" onMouseLeave={() => setTooltip(null)}>
      {isEmptyState && (
        <p className="map-empty-copy">Add goals to see how your wins connect to what you're building.</p>
      )}
      <svg
        className="map-svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Life map connecting areas, active goals, and weekly win clusters"
        onClick={() => setHighlightedArea(null)}
      >
        {displayedEdges.map((edge) => {
          const source = positionedNodeById.get(edge.source)
          const target = positionedNodeById.get(edge.target)
          if (!source || !target) return null
          const isDimmed = highlightedArea !== null && source.area !== highlightedArea && target.area !== highlightedArea
          return (
            <line
              key={`${edge.source}-${edge.target}-${edge.kind}`}
              className="map-edge"
              data-kind={edge.kind}
              data-dimmed={isDimmed ? 'true' : undefined}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            />
          )
        })}

        {positionedNodes.map((node) => {
          const isDimmed = highlightedArea !== null && node.area !== highlightedArea
          return (
            <g
              key={node.id}
              className="map-node-group"
              data-kind={node.kind}
              data-dimmed={isDimmed ? 'true' : undefined}
              transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`}
              onMouseEnter={(event) => setTooltip({ node, clientX: event.clientX, clientY: event.clientY })}
              onMouseMove={(event) => setTooltip({ node, clientX: event.clientX, clientY: event.clientY })}
              onMouseLeave={() => setTooltip(null)}
              onClick={(event) => {
                event.stopPropagation()
                if (node.kind === 'area') setHighlightedArea(node.area)
                if (node.kind === 'goal') onOpenGoals()
              }}
              role={node.kind === 'cluster' ? undefined : 'button'}
              tabIndex={node.kind === 'cluster' ? undefined : 0}
              aria-label={tooltipText(node)}
            >
              <circle
                className="map-node"
                data-kind={node.kind}
                data-area={node.area}
                r={nodeRadius(node)}
              />
              {node.kind === 'area' && (
                <text className="map-area-label" y={nodeRadius(node) + 5} textAnchor="middle">
                  {node.label}
                </text>
              )}
              {node.kind === 'goal' && (
                <text className="map-goal-label" y={nodeRadius(node) + 4.5} textAnchor="middle">
                  {node.title.length > 18 ? `${node.title.slice(0, 18)}...` : node.title}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.clientX + 12, top: tooltip.clientY + 12 }}>
          {tooltipText(tooltip.node)}
        </div>
      )}
    </div>
  )
}
