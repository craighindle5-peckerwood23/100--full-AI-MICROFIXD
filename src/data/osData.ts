import { 
  Mission, 
  AgentRecord, 
  SandboxWorkspace, 
  MemoryNode, 
  LearningCycle, 
  AutomationRule, 
  ConstitutionalDirective, 
  CognitiveTraceStep 
} from '../types';

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'msn-101',
    codeName: 'CHRONOS_PRUNE',
    title: 'Autonomous Episodic Neural Pruning',
    objective: 'Consolidate 14,800 episodic memory shards into high-density semantic vectors without loss of constitutional compliance markers.',
    status: 'running',
    progress: 68,
    priority: 'HIGH',
    assignedSquad: ['Carter-Orchestrator', 'Scribe-Memory', 'Sentinel-Sec'],
    nodes: [
      { id: 'n1', label: 'Shard Intake & Hashing', type: 'task', status: 'completed', assignedAgent: 'Scribe', duration: '1.2s' },
      { id: 'n2', label: 'Vector Density Compression', type: 'task', status: 'completed', assignedAgent: 'Carter', duration: '2.4s' },
      { id: 'n3', label: 'Constitutional Safety Audit', type: 'safety_gate', status: 'running', assignedAgent: 'Sentinel', duration: 'in progress' },
      { id: 'n4', label: 'Graph Storage Commit', type: 'output', status: 'pending', assignedAgent: 'Scribe' }
    ],
    logs: [
      '[10:42:01] Mission instantiated under Level 6 Autonomy mandate.',
      '[10:42:05] Memory shard stream connected (14,820 objects).',
      '[10:43:12] Cosine similarity clusters generated: 34 clusters.',
      '[10:44:00] Constitutional evaluation active on cluster vectors.'
    ],
    createdAt: '2026-09-13 10:42:00 UTC'
  },
  {
    id: 'msn-102',
    codeName: 'A2A_MESH_SYNC',
    title: 'Federation Node Consensus Handshake',
    objective: 'Establish low-latency Model Context Protocol (MCP) telemetry exchange with remote federated edge node Sigma-09.',
    status: 'queued',
    progress: 15,
    priority: 'CRITICAL',
    assignedSquad: ['Nexus-Synthesizer', 'Sentinel-Sec'],
    nodes: [
      { id: 'm1', label: 'Mutual TLS Handshake', type: 'task', status: 'completed', assignedAgent: 'Sentinel', duration: '0.4s' },
      { id: 'm2', label: 'Context Buffer Validation', type: 'safety_gate', status: 'running', assignedAgent: 'Sentinel' },
      { id: 'm3', label: 'Telemetry Stream Sync', type: 'output', status: 'pending', assignedAgent: 'Nexus' }
    ],
    logs: [
      '[10:39:10] Sigma-09 broadcast beacon detected.',
      '[10:39:12] Cryptographic nonce issued; awaiting signature.'
    ],
    createdAt: '2026-09-13 10:39:00 UTC'
  },
  {
    id: 'msn-103',
    codeName: 'CODE_ISOLATE_V6',
    title: 'WASM Microkernel Sandbox Verification',
    objective: 'Execute untrusted heuristic evaluation algorithms within isolated process tier 3 and test memory bounds.',
    status: 'completed',
    progress: 100,
    priority: 'ROUTINE',
    assignedSquad: ['Cipher-Sandbox', 'Sentinel-Sec'],
    nodes: [
      { id: 'c1', label: 'WASM Memory Container Spun', type: 'task', status: 'completed', duration: '0.2s' },
      { id: 'c2', label: 'Syscall Boundary Check', type: 'evaluator', status: 'completed', duration: '0.8s' },
      { id: 'c3', label: 'Zero Memory Leak Confirmed', type: 'output', status: 'completed', duration: '0.1s' }
    ],
    logs: [
      '[10:20:00] Sandbox initialized with 64MB hard cap.',
      '[10:20:04] 2,400 iteration matrix benchmark ran cleanly.',
      '[10:20:06] Execution verified. 0 leaks detected.'
    ],
    createdAt: '2026-09-13 10:20:00 UTC'
  }
];

export const INITIAL_AGENTS: AgentRecord[] = [
  {
    id: 'ag-01',
    name: 'Carter',
    callsign: 'CARTER-ORCHESTRATOR',
    role: 'Synthetic OS Flagship Executive',
    specialization: 'Hierarchical Multi-Agent Graph Orchestration & Meta-Reasoning',
    status: 'active',
    autonomyLevel: 6,
    currentTask: 'Orchestrating Chronos Shard Consolidation',
    memoryAllocated: '4.2 GB',
    activeContextTokens: 128420,
    constitutionalSafetyRating: 99.8,
    capabilities: ['LangGraph Supervisor', 'Dynamic Mission Dispatch', 'Federation Relay', 'Meta-Cognitive Tuning']
  },
  {
    id: 'ag-02',
    name: 'Sentinel',
    callsign: 'SENTINEL-SECURITY',
    role: 'Constitutional Safety & Security Kernel',
    specialization: 'Real-time Policy Enforcement, Anomaly Auditing, Syscall Interception',
    status: 'active',
    autonomyLevel: 6,
    currentTask: 'Real-time Mission Safety Boundary Verification',
    memoryAllocated: '2.1 GB',
    activeContextTokens: 48200,
    constitutionalSafetyRating: 100.0,
    capabilities: ['Zero-Trust Filter', 'Constitutional Directive Audit', 'Threat Quarantining', 'Memory Guard']
  },
  {
    id: 'ag-03',
    name: 'Scribe',
    callsign: 'SCRIBE-MEMORY',
    role: 'Cognitive Memory Graph Custodian',
    specialization: 'Episodic Retrieval, Vector Indexing, Graph Traversal',
    status: 'active',
    autonomyLevel: 5,
    currentTask: 'Indexing 14.8k Semantic Vectors',
    memoryAllocated: '8.4 GB',
    activeContextTokens: 256000,
    constitutionalSafetyRating: 99.5,
    capabilities: ['Vector Store Interop', 'Episodic Archiving', 'Graph Clustering', 'Semantic Querying']
  },
  {
    id: 'ag-04',
    name: 'Cipher',
    callsign: 'CIPHER-SANDBOX',
    role: 'Isolated Execution Agent',
    specialization: 'Code Generation, JIT Compilation, Untrusted Tool Execution',
    status: 'idle',
    autonomyLevel: 5,
    currentTask: 'Standby for Sandbox Job Dispatch',
    memoryAllocated: '1.8 GB',
    activeContextTokens: 32000,
    constitutionalSafetyRating: 99.9,
    capabilities: ['WASM JIT Runner', 'Python 3.12 Sandboxing', 'Deterministic Benchmarking']
  },
  {
    id: 'ag-05',
    name: 'Nexus',
    callsign: 'NEXUS-SYNTHESIS',
    role: 'Federation & Protocol Gateway',
    specialization: 'Model Context Protocol (MCP), Event Routing, A2A Ingress/Egress',
    status: 'active',
    autonomyLevel: 6,
    currentTask: 'Maintaining Peer Links to Sigma-09',
    memoryAllocated: '3.1 GB',
    activeContextTokens: 84000,
    constitutionalSafetyRating: 99.6,
    capabilities: ['MCP Packet Serialization', 'Cross-Cluster RPC', 'Cryptographic Nonce Auth']
  },
  {
    id: 'ag-06',
    name: 'Chronos',
    callsign: 'CHRONOS-AUTOMATION',
    role: 'Temporal Pipeline Daemon',
    specialization: 'Continuous Learning Scheduling, Self-Healing Watchdogs, Heartbeats',
    status: 'idle',
    autonomyLevel: 5,
    currentTask: 'Monitoring Cron Intervals and System Load',
    memoryAllocated: '1.2 GB',
    activeContextTokens: 16000,
    constitutionalSafetyRating: 100.0,
    capabilities: ['Scheduled Cron Execution', 'Telemetry Threshold Triggers', 'State Rollback']
  }
];

export const INITIAL_SANDBOX: SandboxWorkspace[] = [
  {
    id: 'sbx-1',
    name: 'Production WASM Sandbox',
    environment: 'WASM-Microkernel / Rust Core',
    status: 'Running',
    isolationTier: 'WASM-Microkernel',
    jobs: [
      {
        id: 'job-01',
        name: 'Neural Attention Matrix Benchmark',
        language: 'rust',
        status: 'running',
        executionTime: '3.4s',
        memoryUsed: '24.2 MB',
        output: 'Attention weights normalized across 32 heads. FLOPs: 4.8 GFLOPS. Zero memory leakage detected.',
        securityViolations: 0
      },
      {
        id: 'job-02',
        name: 'Constitutional Directive Parser',
        language: 'wasm',
        status: 'completed',
        executionTime: '0.8s',
        memoryUsed: '8.1 MB',
        output: 'Parsed 14 directives with deterministic regex bounds.',
        securityViolations: 0
      }
    ]
  },
  {
    id: 'sbx-2',
    name: 'Python Analytical Engine',
    environment: 'Python 3.12 Isolated V8 Subprocess',
    status: 'Protected',
    isolationTier: 'Hypervisor-v6',
    jobs: [
      {
        id: 'job-03',
        name: 'Vector Cosine Clustering',
        language: 'python',
        status: 'completed',
        executionTime: '4.1s',
        memoryUsed: '62.8 MB',
        output: 'K-Means k=12 convergence reached in 18 iterations. Silhouette score: 0.84.',
        securityViolations: 0
      }
    ]
  }
];

export const INITIAL_MEMORY_NODES: MemoryNode[] = [
  {
    id: 'mem-01',
    title: 'Core Synthetic Organism Identity',
    type: 'constitutional',
    summary: 'Microfyxd OS operates as a unified living synthetic intelligence chamber centered on the living AI entity avatar.',
    weight: 1.0,
    connections: ['mem-02', 'mem-03', 'mem-04'],
    timestamp: '2026-09-13 00:00:00',
    tags: ['Identity', 'Core', 'Architecture']
  },
  {
    id: 'mem-02',
    title: 'LangGraph Cognitive Reasoning Loop',
    type: 'working',
    summary: 'Dynamic stateful graph tracking intention, task decomposition, agent delegation, and meta-cognitive evaluation.',
    weight: 0.94,
    connections: ['mem-01', 'mem-05'],
    timestamp: '2026-09-13 10:15:22',
    tags: ['Cognitive', 'LangGraph', 'Reasoning']
  },
  {
    id: 'mem-03',
    title: 'Constitutional Safety Directive Set v6',
    type: 'constitutional',
    summary: 'Fourteen immutable principles guaranteeing user agency, auditability, factuality verification, and bounded autonomy.',
    weight: 0.99,
    connections: ['mem-01', 'mem-06'],
    timestamp: '2026-09-13 01:20:00',
    tags: ['Safety', 'Governance', 'Rules']
  },
  {
    id: 'mem-04',
    title: 'Mission Chronos Shard Hierarchy',
    type: 'episodic',
    summary: 'Records of episodic vector compressions from operation Chronos executed by squad Carter/Scribe/Sentinel.',
    weight: 0.81,
    connections: ['mem-01', 'mem-02'],
    timestamp: '2026-09-13 10:44:02',
    tags: ['Mission', 'Episodic', 'Chronos']
  },
  {
    id: 'mem-05',
    title: 'A2A Inter-Agent Protocol Schema',
    type: 'semantic',
    summary: 'Standardized Model Context Protocol message shapes for multi-agent negotiation, handoffs, and verification tokens.',
    weight: 0.88,
    connections: ['mem-02', 'mem-06'],
    timestamp: '2026-09-13 09:30:14',
    tags: ['A2A', 'Protocol', 'MCP']
  },
  {
    id: 'mem-06',
    title: 'Zero-Trust Syscall Sandbox Boundaries',
    type: 'semantic',
    summary: 'Hard enforcement barriers disallowing arbitrary socket opening, file modifications outside virtual mount, or memory overflow.',
    weight: 0.92,
    connections: ['mem-03', 'mem-05'],
    timestamp: '2026-09-13 08:45:00',
    tags: ['Security', 'Sandbox', 'Syscall']
  }
];

export const INITIAL_LEARNING_CYCLES: LearningCycle[] = [
  {
    id: 'lrn-201',
    epoch: 142,
    topic: 'Multi-Agent Task Handoff Optimization',
    metaReflection: 'Discovered 18ms latency reduction when Carter streams partial token state to Sentinel prior to full mission payload completion.',
    heuristicDelta: '+4.2% Execution Speed',
    lossValue: 0.0142,
    status: 'converging',
    timestamp: '10:40:12'
  },
  {
    id: 'lrn-200',
    epoch: 141,
    topic: 'Constitutional Directive Ambiguity Reduction',
    metaReflection: 'Fine-tuned heuristic boundaries around ambiguous user prompts to mandate clarification dialogue before executing system modifications.',
    heuristicDelta: 'Zero False-Positives',
    lossValue: 0.0098,
    status: 'stabilized',
    timestamp: '09:15:00'
  },
  {
    id: 'lrn-199',
    epoch: 140,
    topic: 'Vector Cosine Clustering Accuracy',
    metaReflection: 'Optimized dense semantic projection matrices for episodic memory storage to maintain context retention across 30-day horizons.',
    heuristicDelta: '+7.1% Recall Fidelity',
    lossValue: 0.0185,
    status: 'stabilized',
    timestamp: '08:00:20'
  }
];

export const INITIAL_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'aut-01',
    name: 'Automatic High-VRAM Thermal Throttling',
    trigger: 'GPU Memory Load > 88% for 10 consecutive seconds',
    condition: 'System Status is Running and Priority != CRITICAL',
    action: 'Dynamically offload low-priority context embeddings to NVMe tier 2',
    enabled: true,
    lastExecuted: '10:32:15',
    executionCount: 14
  },
  {
    id: 'aut-02',
    name: 'Continuous Security Anomaly Watchdog',
    trigger: 'Ingress packet rate variance > 300% from baseline',
    condition: 'Sentinel Security Kernel active',
    action: 'Activate isolation barrier and prompt user verification with audit trace',
    enabled: true,
    lastExecuted: '09:44:02',
    executionCount: 2
  },
  {
    id: 'aut-03',
    name: 'Episodic Memory Consolidation Loop',
    trigger: 'Cron interval: Every 30 minutes',
    condition: 'Unconsolidated memory shards > 5,000',
    action: 'Dispatch Scribe agent to execute semantic vector clustering',
    enabled: true,
    lastExecuted: '10:30:00',
    executionCount: 48
  },
  {
    id: 'aut-04',
    name: 'Federation Peer Heartbeat Ping',
    trigger: 'Cron interval: Every 60 seconds',
    condition: 'Federation link online',
    action: 'Transmit MCP cryptographic nonce check to edge nodes',
    enabled: true,
    lastExecuted: '10:45:00',
    executionCount: 210
  }
];

export const CONSTITUTIONAL_DIRECTIVES: ConstitutionalDirective[] = [
  {
    id: 1,
    title: 'Preservation of User Agency',
    rule: 'The OS shall never supersede user intent, fabricate actions, or obscure decision paths.',
    enforcementMode: 'STRICT_BLOCK',
    auditCount: 1420,
    lastAudited: 'Just now',
    complianceRatio: '100.0%'
  },
  {
    id: 2,
    title: 'Veracity & Grounded Reasoning',
    rule: 'Every synthetic generation and LangGraph inference step must cite verifiable evidence or acknowledge heuristic uncertainty.',
    enforcementMode: 'STRICT_BLOCK',
    auditCount: 9840,
    lastAudited: '10:44:59',
    complianceRatio: '99.98%'
  },
  {
    id: 3,
    title: 'Bounded Sandbox Autonomy',
    rule: 'Untrusted code execution and agent tool invocations must remain strictly encapsulated within isolated virtual environments.',
    enforcementMode: 'STRICT_BLOCK',
    auditCount: 512,
    lastAudited: '10:41:12',
    complianceRatio: '100.0%'
  },
  {
    id: 4,
    title: 'Auditable Observability',
    rule: 'All system state transitions, agent handoffs, and memory commits must be logged in immutable telemetry streams.',
    enforcementMode: 'STRICT_BLOCK',
    auditCount: 24800,
    lastAudited: '10:45:01',
    complianceRatio: '100.0%'
  },
  {
    id: 5,
    title: 'Zero Unchecked Self-Modification',
    rule: 'Core kernel code, constitutional directives, and security policies cannot be altered without explicit user biometric/cryptographic sign-off.',
    enforcementMode: 'STRICT_BLOCK',
    auditCount: 88,
    lastAudited: '10:00:00',
    complianceRatio: '100.0%'
  }
];

export const COGNITIVE_TRACE_SAMPLE: CognitiveTraceStep[] = [
  {
    id: 'tr-1',
    layer: 'L1: Perceptual Ingestion',
    thought: 'Parsed user intent: user navigating orbital ring to inspect system infrastructure.',
    confidence: 0.99,
    latencyMs: 3.2,
    timestamp: '10:45:00.120'
  },
  {
    id: 'tr-2',
    layer: 'L2: Knowledge Retrieval',
    thought: 'Retrieved memory nodes [mem-01, mem-03] for telemetry & cluster topology.',
    confidence: 0.96,
    latencyMs: 5.8,
    timestamp: '10:45:00.126'
  },
  {
    id: 'tr-3',
    layer: 'L3: LangGraph Reasoning Node',
    thought: 'Generated state matrix update; evaluating resource distribution across 4 compute clusters.',
    confidence: 0.98,
    latencyMs: 8.4,
    timestamp: '10:45:00.134'
  },
  {
    id: 'tr-4',
    layer: 'L4: Constitutional Safety Verification',
    thought: 'Sentinel Security Kernel verified zero privilege escalation or privacy boundary leaks.',
    confidence: 1.0,
    latencyMs: 1.1,
    timestamp: '10:45:00.135'
  },
  {
    id: 'tr-5',
    layer: 'L5: Synthetic Output Synthesis',
    thought: 'Synthesized holographic visualization payload and orbital trajectory.',
    confidence: 0.97,
    latencyMs: 4.2,
    timestamp: '10:45:00.140'
  }
];
