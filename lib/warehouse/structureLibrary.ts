import type {
  WarehouseDepotLayoutObjectKind,
  WarehouseDepotLayoutVisualVariant,
} from './layout';

export type WarehouseStructureCategory =
  | 'storage'
  | 'cold-chain'
  | 'handling'
  | 'circulation'
  | 'area'
  | 'generic';

export interface WarehouseStructureDefinition {
  id: string;
  name: string;
  description: string;
  kind: WarehouseDepotLayoutObjectKind;
  category: WarehouseStructureCategory;
  defaultWidth: number;
  defaultHeight: number;
  minAspectRatio: number;
  maxAspectRatio: number | null;
  defaultRotation: number;
  acceptsLevels: boolean;
  acceptsSubpositions: boolean;
  visualVariant: WarehouseDepotLayoutVisualVariant;
}

export const WAREHOUSE_STRUCTURE_LIBRARY: readonly WarehouseStructureDefinition[] = [
  {
    id: 'shelf',
    name: 'Estante',
    description: 'Estrutura linear de armazenamento com níveis opcionais.',
    kind: 'SHELF',
    category: 'storage',
    defaultWidth: 180,
    defaultHeight: 56,
    minAspectRatio: 1.5,
    maxAspectRatio: 6,
    defaultRotation: 0,
    acceptsLevels: true,
    acceptsSubpositions: true,
    visualVariant: 'solid',
  },
  {
    id: 'rack',
    name: 'Rack',
    description: 'Estrutura de armazenagem de maior porte com níveis opcionais.',
    kind: 'RACK',
    category: 'storage',
    defaultWidth: 200,
    defaultHeight: 68,
    minAspectRatio: 1.4,
    maxAspectRatio: 6,
    defaultRotation: 0,
    acceptsLevels: true,
    acceptsSubpositions: true,
    visualVariant: 'solid',
  },
  {
    id: 'cabinet',
    name: 'Armário',
    description: 'Armário ou estrutura fechada vinculável a uma localização.',
    kind: 'CABINET',
    category: 'storage',
    defaultWidth: 110,
    defaultHeight: 70,
    minAspectRatio: 0.8,
    maxAspectRatio: 3,
    defaultRotation: 0,
    acceptsLevels: true,
    acceptsSubpositions: true,
    visualVariant: 'solid',
  },
  {
    id: 'freezer',
    name: 'Freezer',
    description: 'Equipamento de conservação a frio representado no croqui.',
    kind: 'FREEZER',
    category: 'cold-chain',
    defaultWidth: 120,
    defaultHeight: 72,
    minAspectRatio: 0.8,
    maxAspectRatio: 3,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'solid',
  },
  {
    id: 'refrigerator',
    name: 'Geladeira',
    description: 'Equipamento refrigerado representado sem criar estoque próprio.',
    kind: 'REFRIGERATOR',
    category: 'cold-chain',
    defaultWidth: 90,
    defaultHeight: 72,
    minAspectRatio: 0.7,
    maxAspectRatio: 2.5,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'solid',
  },
  {
    id: 'chamber',
    name: 'Câmara',
    description: 'Área refrigerada ampla, representada como estrutura visual.',
    kind: 'CHAMBER',
    category: 'cold-chain',
    defaultWidth: 220,
    defaultHeight: 160,
    minAspectRatio: 0.7,
    maxAspectRatio: 3,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'solid',
  },
  {
    id: 'pallet',
    name: 'Palete',
    description: 'Posição compacta para representação de palete.',
    kind: 'PALLET',
    category: 'storage',
    defaultWidth: 88,
    defaultHeight: 76,
    minAspectRatio: 0.75,
    maxAspectRatio: 1.75,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'solid',
  },
  {
    id: 'pallet-area',
    name: 'Área de Paletes',
    description: 'Área visual destinada a um conjunto de paletes.',
    kind: 'AREA',
    category: 'area',
    defaultWidth: 260,
    defaultHeight: 180,
    minAspectRatio: 0.8,
    maxAspectRatio: 5,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: true,
    visualVariant: 'zone',
  },
  {
    id: 'bench',
    name: 'Bancada',
    description: 'Bancada de apoio, separação ou manipulação.',
    kind: 'BENCH',
    category: 'handling',
    defaultWidth: 170,
    defaultHeight: 62,
    minAspectRatio: 1.4,
    maxAspectRatio: 5,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'solid',
  },
  {
    id: 'corridor',
    name: 'Corredor',
    description: 'Faixa de circulação longa e estreita.',
    kind: 'CORRIDOR',
    category: 'circulation',
    defaultWidth: 280,
    defaultHeight: 52,
    minAspectRatio: 2,
    maxAspectRatio: 10,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'outline',
  },
  {
    id: 'free-area',
    name: 'Área Livre',
    description: 'Zona livre ou reservada do depósito.',
    kind: 'AREA',
    category: 'area',
    defaultWidth: 220,
    defaultHeight: 150,
    minAspectRatio: 0.5,
    maxAspectRatio: 6,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: false,
    visualVariant: 'zone',
  },
  {
    id: 'other',
    name: 'Outra estrutura',
    description: 'Estrutura genérica para necessidades não previstas no catálogo.',
    kind: 'OTHER',
    category: 'generic',
    defaultWidth: 120,
    defaultHeight: 80,
    minAspectRatio: 0.5,
    maxAspectRatio: 6,
    defaultRotation: 0,
    acceptsLevels: false,
    acceptsSubpositions: true,
    visualVariant: 'solid',
  },
] as const;

export function getWarehouseStructureDefinition(
  id: string
): WarehouseStructureDefinition | null {
  return WAREHOUSE_STRUCTURE_LIBRARY.find((definition) => definition.id === id) || null;
}
