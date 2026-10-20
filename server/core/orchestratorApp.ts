import {MissionDispatcher, type MissionTask, type DispatchResult} from './missionDispatcher';
import {DispatcherTrackingHook, type DatabaseConnection} from './dispatcherTrackingHook';
import {GovernedAdapterRuntime} from '../tools/governedAdapterRuntime';

export interface AppConfig {
  maxConcurrency: number;
}
export interface BootstrappedOrchestrator {
  dispatcher: MissionDispatcher;
  trackingHook: DispatcherTrackingHook;
}
export class OrchestratorApp {
  private dispatcher: MissionDispatcher | undefined;
  private trackingHook: DispatcherTrackingHook | undefined;

  bootstrap(config: AppConfig, dbConnection: DatabaseConnection, runtime: GovernedAdapterRuntime): BootstrappedOrchestrator {
    if (this.dispatcher) throw new Error('Bootstrap Failure: orchestrator already initialized');
    if (!dbConnection || typeof dbConnection.execute !== 'function') throw new Error('Bootstrap Failure: database connection required');
    if (!(runtime instanceof GovernedAdapterRuntime)) throw new Error('Bootstrap Failure: governed runtime required');
    if (!Number.isSafeInteger(config?.maxConcurrency) || config.maxConcurrency<1 || config.maxConcurrency>64) throw new Error('Bootstrap Failure: invalid concurrency');
    const trackingHook=new DispatcherTrackingHook(dbConnection);
    const dispatcher=new MissionDispatcher(runtime,config.maxConcurrency);
    this.trackingHook=trackingHook;
    this.dispatcher=dispatcher;
    return {dispatcher,trackingHook};
  }

  async processOrchestrationPipeline(tasks: MissionTask[]): Promise<DispatchResult[]> {
    if (!this.dispatcher || !this.trackingHook) throw new Error('Execution Failure: bootstrap required');
    const results=await this.dispatcher.dispatchMissionBatch(tasks);
    const tracking=await Promise.allSettled(results.map(result=>this.trackingHook!.logEvent(result)));
    const failures=tracking.filter(result=>result.status==='rejected');
    if (failures.length) throw new AggregateError(failures.map(result=>(result as PromiseRejectedResult).reason),'Dispatch audit persistence failed');
    return results;
  }
}
