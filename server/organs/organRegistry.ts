import { broadcast } from "../events";

export type OrganStatus = "active" | "idle" | "busy" | "error" | "disabled" | "isolated";

export interface OrganRecord {
  id:           string;
  name:         string;
  layer:        string;
  status:       OrganStatus;
  error_count:  number;
  exec_count:   number;
  last_exec:    number;
  last_error?:  string;
  isolated:     boolean;
  metrics: {
    avg_latency_ms: number;
    success_rate:   number;
    total_calls:    number;
  };
  log: { ts: string; action: string; success: boolean; latency_ms: number; error?: string }[];
}

export const ORGAN_DEFINITIONS: { id: string; name: string; layer: string }[] = [
  // ── Layer 1: Core Neural & Cognitive Organs (25) ──
  { id: "brain",                     name: "Brain (LLM Orchestrator)",           layer: "cognition" },
  { id: "reasoning_engine",          name: "Deep Reasoning Engine",             layer: "cognition" },
  { id: "task_interpreter",          name: "Task Intent Interpreter",           layer: "cognition" },
  { id: "prompt_compiler",           name: "Dynamic Prompt Compiler",           layer: "cognition" },
  { id: "cognitive_planner",         name: "Hierarchical Cognitive Planner",    layer: "cognition" },
  { id: "critic_organ",              name: "Autonomous Critic Organ",           layer: "cognition" },
  { id: "reflection_organ",          name: "Episodic Reflection Organ",         layer: "cognition" },
  { id: "doctrine_gate",             name: "Doctrine Pre-check Gate",           layer: "cognition" },
  { id: "synthesis_organ",           name: "Multi-Source Synthesis Organ",      layer: "cognition" },
  { id: "semantic_parser",           name: "Semantic Grammar Parser",           layer: "cognition" },
  { id: "uncertainty_detector",      name: "Cognitive Uncertainty Detector",    layer: "cognition" },
  { id: "latent_space_mapper",       name: "Latent Concept Space Mapper",       layer: "cognition" },
  { id: "hypothesis_generator",      name: "Abductive Hypothesis Generator",    layer: "cognition" },
  { id: "causal_inference",          name: "Causal Inference Engine",           layer: "cognition" },
  { id: "intent_classifier",         name: "Zero-Shot Intent Classifier",       layer: "cognition" },
  { id: "context_window_manager",    name: "Context Window Allocator",          layer: "cognition" },
  { id: "token_optimizer",           name: "Token Budget & Entropy Optimizer",  layer: "cognition" },
  { id: "prompt_cache",              name: "Prompt Embedding Cache",            layer: "cognition" },
  { id: "chain_of_thought",          name: "Chain-of-Thought Verifier",         layer: "cognition" },
  { id: "self_consistency_checker",  name: "Consensus Self-Consistency Checker",layer: "cognition" },
  { id: "deep_thought_engine",       name: "Recursive Deep Thought Engine",     layer: "cognition" },
  { id: "symbolic_reasoner",         name: "First-Order Symbolic Reasoner",     layer: "cognition" },
  { id: "analogical_mapper",         name: "Cross-Domain Analogical Mapper",    layer: "cognition" },
  { id: "knowledge_retriever",       name: "Contextual Knowledge Retriever",    layer: "cognition" },
  { id: "multi_modal_fusion",        name: "Multi-Modal Sensorimotor Fusion",   layer: "cognition" },

  // ── Layer 2: Perception, Sensors & Sensory Mesh (22) ──
  { id: "vision_analyzer",           name: "Computer Vision & Visual Analyzer", layer: "perception" },
  { id: "stt_organ",                 name: "Neural Speech-to-Text Organ",      layer: "perception" },
  { id: "acoustic_sensor",           name: "Real-time Acoustic Field Sensor",   layer: "perception" },
  { id: "audio_feature_extractor",   name: "FFT Spectrogram Feature Extractor", layer: "perception" },
  { id: "telemetry_sensor",          name: "Telemetry Mesh Sensor Collector",   layer: "perception" },
  { id: "anomaly_detector",          name: "Statistical Anomaly Detector",     layer: "perception" },
  { id: "drift_sensor",              name: "Concept & Parameter Drift Sensor",  layer: "perception" },
  { id: "latency_sensor",            name: "Microsecond Latency Sensor",       layer: "perception" },
  { id: "memory_pressure_sensor",    name: "V8 Heap & Memory Pressure Sensor",  layer: "perception" },
  { id: "cpu_load_sensor",           name: "CPU Quantum & Load Profiler",       layer: "perception" },
  { id: "network_traffic_monitor",   name: "Inbound/Outbound Network Monitor",  layer: "perception" },
  { id: "io_throughput_sensor",      name: "Disk & Storage IOPS Monitor",       layer: "perception" },
  { id: "token_velocity_sensor",     name: "Tokens-per-Second Velocity Tracker",layer: "perception" },
  { id: "websocket_sensor",          name: "WebSocket Frame Rate & Heartbeat",  layer: "perception" },
  { id: "client_state_sensor",       name: "Client DOM & Viewport Telemetry",   layer: "perception" },
  { id: "dom_mutation_sensor",       name: "DOM Mutation Observer & Diff Trap", layer: "perception" },
  { id: "screen_capture_organ",      name: "Live Frame Screen Capture Organ",   layer: "perception" },
  { id: "clipboard_sensor",          name: "Contextual Clipboard Ingest Organ", layer: "perception" },
  { id: "environmental_sensor",      name: "Operating System Runtime Sensor",   layer: "perception" },
  { id: "error_rate_monitor",        name: "Standard Error Spike Detector",     layer: "perception" },
  { id: "packet_inspector",          name: "RPC & Packet Header Inspector",     layer: "perception" },
  { id: "stream_telemetry_organ",    name: "Live Stream Telemetry Channel",     layer: "perception" },

  // ── Layer 3: Executive, Autonomous & Orchestration (25) ──
  { id: "scheduler",                 name: "Autonomous Scheduler",              layer: "autonomy" },
  { id: "background_loop",           name: "Continuous Cognitive Loop",         layer: "autonomy" },
  { id: "cognitive_feedback",        name: "Cognitive Feedback Loop",           layer: "autonomy" },
  { id: "mission_state",             name: "Mission State Machine",             layer: "autonomy" },
  { id: "mission_engine",            name: "Multi-Agent Mission Engine",        layer: "autonomy" },
  { id: "task_graph_orchestrator",   name: "DAG Task Graph Orchestrator",       layer: "autonomy" },
  { id: "dispatch_controller",       name: "Agent Dispatch Controller",         layer: "autonomy" },
  { id: "retry_manager",             name: "Exponential Backoff Retry Manager", layer: "autonomy" },
  { id: "checkpoint_organ",          name: "Cognitive State Checkpoint Organ",  layer: "autonomy" },
  { id: "priority_queue_manager",    name: "Priority Action Queue Manager",     layer: "autonomy" },
  { id: "autonomous_sentinel",       name: "Autonomous Health Sentinel",        layer: "autonomy" },
  { id: "self_healer",               name: "Process Isolation & Auto-Healer",   layer: "autonomy" },
  { id: "reflex",                    name: "Reflex Engine",                     layer: "autonomy" },
  { id: "interrupt_handler",         name: "Sub-millisecond Interrupt Handler", layer: "autonomy" },
  { id: "preemptive_scheduler",      name: "Preemptive Task Arbiter",           layer: "autonomy" },
  { id: "resource_arbiter",          name: "Hardware Resource Arbiter",         layer: "autonomy" },
  { id: "deadline_enforcer",         name: "Mission SLA & Deadline Enforcer",   layer: "autonomy" },
  { id: "execution_spine",           name: "Execution Spine Orchestrator",      layer: "autonomy" },
  { id: "pipeline_coordinator",      name: "Parallel Pipeline Coordinator",     layer: "autonomy" },
  { id: "supervisor_tree",           name: "Erlang-Style Supervisor Tree",      layer: "autonomy" },
  { id: "task_decomposer",           name: "Recursive Task Decomposer",         layer: "autonomy" },
  { id: "worker_pool_manager",       name: "Dynamic Worker Pool Allocator",     layer: "autonomy" },
  { id: "lifecycle_organ",           name: "Organism Lifecycle Manager",        layer: "autonomy" },
  { id: "event_bus_orchestrator",    name: "Central Event Bus Orchestrator",    layer: "autonomy" },
  { id: "watchdog_timer",            name: "Hardware Watchdog Timer",           layer: "autonomy" },

  // ── Layer 4: Memory, Vector & Knowledge Graph (25) ──
  { id: "memory",                    name: "Memory (Supabase Vector)",          layer: "memory" },
  { id: "supabase_vector_memory",    name: "Supabase pgvector Store",           layer: "memory" },
  { id: "episodic_store",            name: "Episodic Run & Trace Store",        layer: "memory" },
  { id: "semantic_graph",            name: "Knowledge Semantic Graph Organ",    layer: "memory" },
  { id: "working_memory",            name: "Ring-0 Working RAM Buffer",         layer: "memory" },
  { id: "cache_organ",               name: "LRU Sub-millisecond Cache",         layer: "memory" },
  { id: "kv_store",                  name: "Atomic Key-Value Store",            layer: "memory" },
  { id: "memory_pruner",             name: "Vector Memory Pruning Organ",       layer: "memory" },
  { id: "embedding_engine",          name: "Text-Embedding-004 Vectorizer",    layer: "memory" },
  { id: "pgvector_client",           name: "pgvector Index Optimization Organ", layer: "memory" },
  { id: "memory_clusterer",          name: "Cosine K-Means Memory Clusterer",   layer: "memory" },
  { id: "hierarchical_memory",       name: "Multi-Tier Hierarchical Memory",    layer: "memory" },
  { id: "memory_decay_engine",       name: "Exponential Memory Decay Engine",   layer: "memory" },
  { id: "recall_keyword_organ",      name: "Inverted Index Keyword Searcher",   layer: "memory" },
  { id: "semantic_indexer",          name: "Hierarchical Navigable Small World",layer: "memory" },
  { id: "episodic_compressor",       name: "Lossless Episode Compressor",       layer: "memory" },
  { id: "associative_memory",        name: "Hopfield Associative Memory",       layer: "memory" },
  { id: "context_retriever",         name: "Top-K Context Retrieval Organ",     layer: "memory" },
  { id: "transaction_log",           name: "Write-Ahead Transaction Log",       layer: "memory" },
  { id: "snapshot_organ",            name: "Differential State Snapshot Organ", layer: "memory" },
  { id: "persistence_manager",       name: "Unified Persistence Coordinator",   layer: "memory" },
  { id: "state_synchronizer",        name: "Supabase State Synchronizer",       layer: "memory" },
  { id: "vector_deduplicator",       name: "Vector Hash Deduplicator",          layer: "memory" },
  { id: "memory_audit_organ",        name: "Memory Consistency Auditor",        layer: "memory" },
  { id: "long_term_consolidator",    name: "REM-Cycle Memory Consolidator",     layer: "memory" },

  // ── Layer 5: Agent Society & Specialized Autonomous Agents (35) ──
  { id: "agent_carter",              name: "Agent Carter (Executive Supervisor)", layer: "agents" },
  { id: "agent_sentinel",            name: "Agent Sentinel (Security Kernel)",   layer: "agents" },
  { id: "agent_cipher",              name: "Agent Cipher (Sandbox Specialist)",  layer: "agents" },
  { id: "agent_scribe",              name: "Agent Scribe (Memory & Documentation)",layer: "agents" },
  { id: "agent_nexus",               name: "Agent Nexus (Federation Synthesizer)",layer: "agents" },
  { id: "agent_turing",              name: "Agent Turing (Algorithm Optimizer)", layer: "agents" },
  { id: "agent_ada",                 name: "Agent Ada (Code Synthesizer)",       layer: "agents" },
  { id: "agent_volta",               name: "Agent Volta (Telemetry & Signal)",   layer: "agents" },
  { id: "agent_bohr",                name: "Agent Bohr (Model Fine-Tuner)",      layer: "agents" },
  { id: "agent_curie",               name: "Agent Curie (Heuristic Experimenter)",layer: "agents" },
  { id: "agent_feynman",             name: "Agent Feynman (Cognitive Explainer)",layer: "agents" },
  { id: "agent_lovelace",            name: "Agent Lovelace (Logic Validator)",   layer: "agents" },
  { id: "agent_newton",              name: "Agent Newton (Deterministic Solver)",layer: "agents" },
  { id: "agent_darwin",              name: "Agent Darwin (Genetic Prompt Mutator)",layer: "agents" },
  { id: "agent_maxwell",             name: "Agent Maxwell (Flux Arbiter)",       layer: "agents" },
  { id: "agent_tesla",               name: "Agent Tesla (High-Speed Transmitter)",layer: "agents" },
  { id: "agent_planck",              name: "Agent Planck (Quantum Step Slicer)", layer: "agents" },
  { id: "agent_goedel",              name: "Agent Gödel (Formal Invariance)",    layer: "agents" },
  { id: "agent_hopper",              name: "Agent Hopper (Self-Debugger)",       layer: "agents" },
  { id: "agent_knuth",               name: "Agent Knuth (Data Structure Engine)",layer: "agents" },
  { id: "agent_shannon",             name: "Agent Shannon (Information Entropy)",layer: "agents" },
  { id: "agent_mccarthy",            name: "Agent McCarthy (LISP Meta-Evaluator)",layer: "agents" },
  { id: "agent_minsky",              name: "Agent Minsky (Society of Mind)",     layer: "agents" },
  { id: "agent_berners_lee",         name: "Agent Berners-Lee (Web Scraper)",    layer: "agents" },
  { id: "agent_ritchie",             name: "Agent Ritchie (C/WASM Systems Core)",layer: "agents" },
  { id: "agent_thompson",            name: "Agent Thompson (UNIX Process Engine)",layer: "agents" },
  { id: "agent_torvalds",            name: "Agent Torvalds (Kernel Evolution)",  layer: "agents" },
  { id: "agent_neumann",             name: "Agent von Neumann (Self-Replicator)",layer: "agents" },
  { id: "agent_wiener",              name: "Agent Wiener (Cybernetics Regulator)",layer: "agents" },
  { id: "agent_euler",               name: "Agent Euler (Topological Grapher)",  layer: "agents" },
  { id: "agent_gauss",               name: "Agent Gauss (Normalizer & Stats)",   layer: "agents" },
  { id: "agent_hypatia",             name: "Agent Hypatia (Philosophical Guard)",layer: "agents" },
  { id: "agent_aristotle",           name: "Agent Aristotle (Categorical Logic)",layer: "agents" },
  { id: "agent_socrates",            name: "Agent Socrates (Dialectical Probe)", layer: "agents" },
  { id: "agent_router",              name: "Agent Router & Dispatch Matrix",    layer: "agents" },

  // ── Layer 6: Security, Governance & Constitutional Gates (25) ──
  { id: "security_spine",            name: "Security Spine Guard",               layer: "security" },
  { id: "governance",                name: "Governance Engine",                  layer: "security" },
  { id: "constitution",              name: "Constitution Engine",                layer: "security" },
  { id: "paragon",                   name: "Paragon Dissector",                  layer: "security" },
  { id: "anti_tamper",               name: "Anti-Tamper Cryptographic Seal",    layer: "security" },
  { id: "anti_drift",                name: "Anti-Drift Vector Anchor",           layer: "security" },
  { id: "identity_lock",             name: "Immutable Identity Lock",            layer: "security" },
  { id: "rbac_enforcer",             name: "RBAC Role-Based Access Controller",  layer: "security" },
  { id: "hitl",                      name: "Human-in-the-Loop Gateway",          layer: "security" },
  { id: "zero_trust_evaluator",      name: "Zero-Trust Lattice Evaluator",       layer: "security" },
  { id: "audit_logger",              name: "Tamper-Evident Audit Logger",        layer: "security" },
  { id: "credential_sanitizer",      name: "Secret & Credential Redactor",       layer: "security" },
  { id: "token_validator",           name: "JWT & Bearer Token Validator",       layer: "security" },
  { id: "syscall_firewall",          name: "Syscall Interception Firewall",      layer: "security" },
  { id: "code_signing_verifier",     name: "Ed25519 Code Signing Verifier",      layer: "security" },
  { id: "integrity_monitor",         name: "SHA-256 Codebase Integrity Monitor", layer: "security" },
  { id: "boundary_enforcer",         name: "Memory Boundary Enforcer",           layer: "security" },
  { id: "permission_grantor",        name: "Dynamic Capability Grantor",         layer: "security" },
  { id: "threat_mitigator",          name: "Active Threat Mitigation Unit",      layer: "security" },
  { id: "containment_unit",          name: "Blast Radius Containment Unit",      layer: "security" },
  { id: "tamper_alert_broadcaster",  name: "Tamper Alarm WebSocket Emitter",     layer: "security" },
  { id: "security_tracer",           name: "Security Flow Tracer",               layer: "security" },
  { id: "policy_verifier",           name: "Constitutional Safety Rule Verifier",layer: "security" },
  { id: "vulnerability_scanner",     name: "Dependency Vulnerability Scanner",   layer: "security" },
  { id: "overwatch",                 name: "Metacognitive Overwatch",            layer: "security" },

  // ── Layer 7: Execution, Tools & Sandbox (25) ──
  { id: "playwright",                name: "Playwright Headless Browser",        layer: "execution" },
  { id: "sandbox",                   name: "Sandbox Chamber",                    layer: "execution" },
  { id: "wasm_sandbox",              name: "WASM Microkernel Sandbox",           layer: "execution" },
  { id: "node_runner",               name: "Node.js In-Process Runner",          layer: "execution" },
  { id: "bash_executor",             name: "Isolated Bash Shell Executor",       layer: "execution" },
  { id: "python_runner",             name: "Embedded Python Execution Engine",   layer: "execution" },
  { id: "github_connector",          name: "GitHub API Connector",               layer: "execution" },
  { id: "git_committer",             name: "Automated Git Committer & Brancher", layer: "execution" },
  { id: "crawl_engine",              name: "Recursive Web Crawl Engine",         layer: "execution" },
  { id: "web_scraper",               name: "Cheerio DOM Content Extractor",      layer: "execution" },
  { id: "http_client",               name: "Resilient HTTP/S Connection Pool",   layer: "execution" },
  { id: "mcp_client",                name: "MCP Client",                         layer: "execution" },
  { id: "mcp_server",                name: "MCP Model Context Protocol Server",  layer: "execution" },
  { id: "code_linter",               name: "Real-time TypeScript Linter",        layer: "execution" },
  { id: "typescript_compiler",       name: "TypeScript AST Type-Checker",        layer: "execution" },
  { id: "ast_parser",                name: "Abstract Syntax Tree Parser",        layer: "execution" },
  { id: "patch_applicator",          name: "Universal Unified Diff Applicator",  layer: "execution" },
  { id: "diff_engine",               name: "Semantic Code Diff Engine",          layer: "execution" },
  { id: "shell_exec_unit",           name: "Piped Subprocess Shell Exec Unit",   layer: "execution" },
  { id: "file_system_organ",         name: "Atomic File System Driver",          layer: "execution" },
  { id: "file_watcher",              name: "File System Event Inotify Watcher",  layer: "execution" },
  { id: "package_inspector",         name: "NPM Package Manifest Inspector",    layer: "execution" },
  { id: "dependency_verifier",       name: "Dependency Tree Soundness Verifier", layer: "execution" },
  { id: "unit_test_runner",          name: "Autonomous Test Suite Runner",       layer: "execution" },
  { id: "output_streamer",           name: "Chunked Response Output Streamer",   layer: "execution" },

  // ── Layer 8: Cross-AI Bridges, Federation & Protocols (20) ──
  { id: "cross_ai_bridge",           name: "Cross-AI Dynamic Model Bridge",      layer: "federation" },
  { id: "federation",                name: "Federation Layer",                   layer: "federation" },
  { id: "a2a_federation_relay",      name: "Agent-to-Agent (A2A) Relay",         layer: "federation" },
  { id: "groq_provider",             name: "Groq LPU Ultra-Low-Latency Bridge",  layer: "federation" },
  { id: "gemini_provider",           name: "Google Gemini 2.5 Multi-Modal Bridge",layer: "federation" },
  { id: "openai_provider",           name: "OpenAI GPT-4o Frontier Bridge",      layer: "federation" },
  { id: "anthropic_provider",        name: "Anthropic Claude 3.7 Sonnet Bridge", layer: "federation" },
  { id: "deepseek_provider",         name: "DeepSeek Reasoning V3 Bridge",       layer: "federation" },
  { id: "copilot_provider",          name: "GitHub Copilot API Bridge",          layer: "federation" },
  { id: "devin_provider",            name: "Devin Autonomous Agent Bridge",      layer: "federation" },
  { id: "claude_provider",           name: "Claude Code Context Bridge",         layer: "federation" },
  { id: "model_context_protocol",    name: "MCP Standard Context Protocol",      layer: "federation" },
  { id: "federated_consensus",       name: "PBFT Byzantine Fault Consensus",     layer: "federation" },
  { id: "consensus_arbiter",         name: "Multi-Model Output Arbiter",         layer: "federation" },
  { id: "quorum_manager",            name: "Federated Node Quorum Manager",      layer: "federation" },
  { id: "peer_discovery",            name: "mDNS Peer Discovery Node",           layer: "federation" },
  { id: "edge_sync_node",            name: "Edge Cache State Synchronizer",      layer: "federation" },
  { id: "protocol_normalizer",       name: "OpenAI / Claude Format Normalizer",  layer: "federation" },
  { id: "fallback_chain_manager",    name: "Multi-Provider Fallback Cascade",    layer: "federation" },
  { id: "websocket_mesh",            name: "Distributed WebSocket Mesh Bridge",  layer: "federation" },

  // ── Layer 9: Voice, Speech & Audio Worklets (15) ──
  { id: "voice",                     name: "Voice (STT/TTS)",                    layer: "voice" },
  { id: "voice_tts",                 name: "Neural Text-to-Speech Synthesizer", layer: "voice" },
  { id: "voice_stt",                 name: "Continuous Streaming STT Engine",    layer: "voice" },
  { id: "speech_cleaner",            name: "Phonetic Hallucination Stripper",    layer: "voice" },
  { id: "voice_emotion",             name: "Voice Emotion & Valence Organ",      layer: "voice" },
  { id: "emotion_engine",            name: "Synthetic Emotion Engine",           layer: "voice" },
  { id: "audio_worklet",             name: "High-Frequency Audio Worklet Node",  layer: "voice" },
  { id: "conversational_timer",      name: "Turn-Taking Conversational Timer",   layer: "voice" },
  { id: "voice_cortex_bridge",       name: "Voice-Cortex Bi-Directional Bridge", layer: "voice" },
  { id: "grammar_engine",            name: "Spoken Grammar State Automaton",     layer: "voice" },
  { id: "audio_visualizer",          name: "Spectral FFT Canvas Visualizer",     layer: "voice" },
  { id: "pitch_analyzer",            name: "Autocorrelation Pitch Analyzer",     layer: "voice" },
  { id: "voice_output_organ",        name: "Spatial Audio Output Organ",         layer: "voice" },
  { id: "utterance_boundary_detector",name: "VAD Utterance Boundary Detector",   layer: "voice" },
  { id: "voice_buffer_stream",       name: "Linear PCM Audio Stream Buffer",     layer: "voice" },

  // ── Layer 10: Infrastructure, Evolution & Self-Repair (18) ──
  { id: "evolution_engine",          name: "Evolution Engine",                   layer: "evolution" },
  { id: "self_repair",               name: "Self-Repair Engine",                 layer: "evolution" },
  { id: "self_morphing",             name: "Dynamic Self-Morphing Architecture", layer: "evolution" },
  { id: "health_monitor",            name: "Health Monitor & Circuit Breaker",   layer: "evolution" },
  { id: "db_migration_organ",        name: "Automated DB Schema Migrator",       layer: "evolution" },
  { id: "supabase_sync_organ",       name: "Supabase Realtime Cloud Syncer",     layer: "evolution" },
  { id: "telemetry_grid",            name: "Real-time Telemetry Vector Grid",    layer: "evolution" },
  { id: "system_diagnostics",        name: "Deep Kernel Diagnostic Prober",      layer: "evolution" },
  { id: "performance_profiler",      name: "CPU Flame-Graph Performance Profiler",layer: "evolution" },
  { id: "garbage_collector",         name: "Deterministic Object GC Organ",      layer: "evolution" },
  { id: "heap_allocator",            name: "Slab Memory Heap Allocator",         layer: "evolution" },
  { id: "cluster_node_manager",      name: "Cluster Node Heartbeat Overseer",    layer: "evolution" },
  { id: "container_lifecycle",       name: "Docker/PaaS Container Lifecycle",    layer: "evolution" },
  { id: "circuit_breaker",           name: "Fault Isolation Circuit Breaker",    layer: "evolution" },
  { id: "config_loader",             name: "Dynamic Environment Config Loader",  layer: "evolution" },
  { id: "env_synchronizer",          name: "Render / Supabase Secrets Syncer",   layer: "evolution" },
  { id: "metric_exporter",           name: "Prometheus/OpenTelemetry Exporter",  layer: "evolution" },
  { id: "crash_reporter",            name: "Zero-Data-Loss Crash Reporter",      layer: "evolution" },

  // ── Layer 11: World Thinking & Orchestration Oversight (12) ──
  { id: "world_model",                   name: "World Model & State Simulator",        layer: "world_thinking" },
  { id: "world_thinking_engine",         name: "Counterfactual World Thinking Engine", layer: "world_thinking" },
  { id: "counterfactual_simulator",      name: "Multi-Branch Counterfactual Search",   layer: "world_thinking" },
  { id: "epistemic_uncertainty_scorer",  name: "Epistemic Uncertainty Estimator",      layer: "world_thinking" },
  { id: "future_state_projector",        name: "State Trajectory & Drift Forecaster",  layer: "world_thinking" },
  { id: "invariance_verifier",           name: "Mathematical Invariant Preserver",     layer: "world_thinking" },
  { id: "orchestration_oversight",       name: "Hierarchical Oversight Supervisor",    layer: "oversight" },
  { id: "recursion_governor",            name: "Call-Stack Recursion Depth Arbiter",   layer: "oversight" },
  { id: "subagent_mesh_arbiter",         name: "Sub-Agent Mesh Spawner & Barrier",     layer: "oversight" },
  { id: "emergency_kill_switch",         name: "Zero-State Emergency Circuit Interrupter", layer: "oversight" },
  { id: "hallucination_pruner",          name: "Counterfactual Hallucination Pruner",  layer: "world_thinking" },
  { id: "anti_drift_anchor",             name: "Identity & Invariant Anti-Drift Lock", layer: "oversight" },
];

class OrganRegistry {
  private organs = new Map<string, OrganRecord>();

  constructor() {
    for (const def of ORGAN_DEFINITIONS) {
      this.organs.set(def.id, {
        id:          def.id,
        name:        def.name,
        layer:       def.layer,
        status:      "idle",
        error_count: 0,
        exec_count:  0,
        last_exec:   0,
        isolated:    false,
        metrics: { avg_latency_ms: 0, success_rate: 1.0, total_calls: 0 },
        log: [],
      });
    }
  }

  get(id: string): OrganRecord | undefined { return this.organs.get(id); }
  all(): OrganRecord[]                      { return Array.from(this.organs.values()); }

  setStatus(id: string, status: OrganStatus, error?: string): void {
    const organ = this.organs.get(id);
    if (!organ) return;
    organ.status      = status;
    if (error) organ.last_error = error;
    broadcast("organ:status_update", { id, status, error });
  }

  recordExec(id: string, success: boolean, latency_ms: number, action: string, error?: string): void {
    const organ = this.organs.get(id);
    if (!organ) return;
    organ.exec_count++;
    organ.last_exec = Date.now();
    if (!success) organ.error_count++;
    const m = organ.metrics;
    m.total_calls++;
    m.avg_latency_ms = (m.avg_latency_ms * (m.total_calls - 1) + latency_ms) / m.total_calls;
    m.success_rate   = (m.success_rate * (m.total_calls - 1) + (success ? 1 : 0)) / m.total_calls;
    organ.log.push({ ts: new Date().toISOString(), action, success, latency_ms, error });
    if (organ.log.length > 100) organ.log.shift();
    broadcast("organ:exec_result", { id, success, latency_ms, action });
  }

  reset(id: string): boolean {
    const organ = this.organs.get(id);
    if (!organ) return false;
    organ.status      = "idle";
    organ.error_count = 0;
    organ.last_error  = undefined;
    organ.isolated    = false;
    broadcast("organ:reset", { id });
    return true;
  }

  isolate(id: string): boolean {
    const organ = this.organs.get(id);
    if (!organ) return false;
    organ.isolated = true;
    organ.status   = "disabled";
    broadcast("organ:isolated", { id });
    return true;
  }

  systemHealth(): "nominal" | "degraded" | "critical" {
    const all     = this.all();
    const errors  = all.filter(o => o.status === "error").length;
    const critIds = ["brain", "memory", "constitution", "governance"];
    const critErr = all.filter(o => critIds.includes(o.id) && o.status === "error").length;
    if (critErr > 0)     return "critical";
    if (errors > 3)      return "degraded";
    return "nominal";
  }
}

export const organRegistry = new OrganRegistry();
