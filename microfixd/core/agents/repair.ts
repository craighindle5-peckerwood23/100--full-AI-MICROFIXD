// Canonical repair compatibility definitions.
// Level 6 Autonomous Repair Agent with Claude Sonnet Tool Use & Autonomous Fallback

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface RepairAgentOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  subsystemContext?: any;
  autoExecuteTools?: boolean;
}

export interface RepairToolCall {
  id: string;
  name: string;
  input: any;
  result?: any;
  status: 'pending' | 'success' | 'failed';
}

export interface RepairAgentExecutionResult {
  source: 'claude_api' | 'autonomous_engine_fallback';
  rawResponse?: any;
  plan?: string;
  toolCalls: RepairToolCall[];
  status: 'repaired' | 'analyzed' | 'failed';
  summary: string;
  metrics: {
    syntaxErrorsFound: number;
    patchesGenerated: number;
    testsPassed: boolean;
    verificationScore: number;
    durationMs: number;
  };
  timestamp: number;
}

/**
 * Tool definitions for Claude repair agent matching the Anthropic tool-use schema.
 */
export const REPAIR_TOOLS: AnthropicTool[] = [
  {
    name: "analyze_code",
    description: "Scan codebase for syntax/logic errors",
    input_schema: {
      type: "object",
      properties: {
        target_path: {
          type: "string",
          description: "Path, organ, or subsystem to inspect for defects"
        },
        issue_description: {
          type: "string",
          description: "Description of the anomaly, error stack trace, or regression"
        }
      },
      required: ["issue_description"]
    }
  },
  {
    name: "generate_fix",
    description: "Generate corrected code",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Target file path or organ module to repair"
        },
        diagnosis: {
          type: "string",
          description: "Root cause diagnosis from code analysis"
        },
        patch_code: {
          type: "string",
          description: "Corrected typescript or configuration code"
        }
      },
      required: ["diagnosis", "patch_code"]
    }
  },
  {
    name: "apply_patch",
    description: "Apply fixes to actual files",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Target file path"
        },
        patch_diff: {
          type: "string",
          description: "Unified patch diff or sanitized code block"
        },
        dry_run: {
          type: "boolean",
          description: "If true, validates patch without writing"
        }
      },
      required: ["file_path", "patch_diff"]
    }
  },
  {
    name: "run_tests",
    description: "Verify repairs work",
    input_schema: {
      type: "object",
      properties: {
        test_suite: {
          type: "string",
          description: "Specific unit test suite, invariant verification, or constitutional audit"
        }
      }
    }
  }
];

/**
 * Built-in tool execution handlers for the Microfyxd environment.
 */
/** Legacy entry points cannot claim host edits or tests without real executors. */
export async function executeRepairTool(_name:string,_input:any):Promise<never>{
 throw new Error('REPAIR_EXECUTOR_NOT_IMPLEMENTED_USE_DURABLE_MISSION');
}
export const runRepairAgent=async(_input:string,_options?:RepairAgentOptions):Promise<RepairAgentExecutionResult>=>{
 throw new Error('LEGACY_REPAIR_RETIRED_USE_DURABLE_MISSION');
};
export const RepairAgent={name:'Repair Agent',role:'Governed repair requires a durable mission',execute:async(_context:any):Promise<never>=>{
 throw new Error('LEGACY_REPAIR_RETIRED_USE_DURABLE_MISSION');
}};
