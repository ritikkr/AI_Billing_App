import clsx from 'clsx';
import type { DocumentDesign } from '../../types';

export function DesignThumbnail({ design }: { design: DocumentDesign }) {
  return (
    <div
      className={clsx(
        'h-9 w-16 shrink-0 overflow-hidden rounded-md border',
        design === 'classic' ? 'border-slate-200' : design === 'modern' ? 'border-indigo-200' : 'border-slate-300'
      )}
      role="presentation"
      aria-hidden="true"
    >
      {design === 'classic' && (
        <div className="h-full bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-1 pt-1">
            <div className="h-1.5 w-4 rounded-sm bg-slate-300" />
            <div className="h-1.5 w-4 rounded-sm bg-indigo-500" />
          </div>
          <div className="mt-1 h-1 w-7 rounded-sm bg-slate-200" />
          <div className="mt-1 h-1 w-6 rounded-sm bg-slate-100" />
          <div className="mt-1 h-1 w-8 rounded-sm bg-slate-100" />
        </div>
      )}
      {design === 'modern' && (
        <div className="h-full">
          <div className="h-1/3 bg-indigo-600 px-1 pt-1">
            <div className="h-1 w-5 rounded-sm bg-white/80" />
            <div className="mt-1 h-1 w-4 rounded-sm bg-white/50" />
          </div>
          <div className="space-y-1 bg-white p-1">
            <div className="h-1 w-8 rounded-sm bg-slate-200" />
            <div className="h-1 w-7 rounded-sm bg-slate-100" />
            <div className="h-1 w-6 rounded-sm bg-indigo-100" />
          </div>
        </div>
      )}
      {design === 'minimal' && (
        <div className="h-full bg-white p-1">
          <div className="mx-auto h-1 w-4 rounded-sm bg-slate-400" />
          <div className="mt-1 h-px bg-slate-300" />
          <div className="mt-1 h-1 w-7 rounded-sm bg-slate-100" />
          <div className="mt-1 h-1 w-8 rounded-sm bg-slate-100" />
          <div className="mt-1 h-1 w-6 rounded-sm bg-slate-100" />
        </div>
      )}
      {design === 'vyapar' && (
        <div className="h-full bg-white p-px">
          <div className="mx-auto h-1 w-6 rounded-sm bg-slate-500" />
          <div className="mt-0.5 flex rounded-sm border border-slate-300">
            <div className="flex-1 border-r border-slate-300 p-0.5">
              <div className="h-0.5 w-5 rounded-sm bg-slate-400" />
              <div className="mt-0.5 h-0.5 w-4 rounded-sm bg-slate-200" />
              <div className="mt-0.5 h-0.5 w-5 rounded-sm bg-slate-200" />
            </div>
            <div className="w-1/2 p-0.5">
              <div className="h-0.5 w-4 rounded-sm bg-slate-400" />
              <div className="mt-0.5 h-0.5 w-3 rounded-sm bg-slate-200" />
            </div>
          </div>
          <div className="mt-0.5 flex rounded-sm border border-slate-300">
            <div className="h-0.5 w-3 rounded-sm bg-slate-300" />
            <div className="h-0.5 w-3 rounded-sm bg-slate-300" />
            <div className="h-0.5 w-3 rounded-sm bg-slate-300" />
          </div>
        </div>
      )}
    </div>
  );
}