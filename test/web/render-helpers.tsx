import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderWeb(ui: ReactElement) {
  return render(ui);
}
