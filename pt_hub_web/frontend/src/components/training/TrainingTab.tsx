import { TrainingControls } from './TrainingControls';
import { NeuralSignals } from './NeuralSignals';
import { TrainerOutput } from './TrainerOutput';

export function TrainingTab() {
  return (
    <div className="flex h-full gap-3">
      {/* Left side - Training Controls & Neural Signals (50%) */}
      <div className="w-1/2 flex flex-col gap-3">
        {/* Training Controls */}
        <div className="h-1/2 rounded-xl overflow-auto" style={{ background: '#18181b' }}>
          <TrainingControls />
        </div>

        {/* Neural Signals */}
        <div className="h-1/2 rounded-xl overflow-auto" style={{ background: '#18181b' }}>
          <NeuralSignals />
        </div>
      </div>

      {/* Right side - Trainer Output (50%) */}
      <div className="w-1/2 rounded-xl flex flex-col overflow-hidden" style={{ background: '#18181b' }}>
        <TrainerOutput />
      </div>
    </div>
  );
}
