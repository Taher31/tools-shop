import { AppException } from '../../common/errors/app-exception';

/**
 * AI could not run. `disabled`, `budget` and `no_key` are configuration states (do not
 * retry); `provider` is a transient model/network failure (queues retry it).
 */
export class AiUnavailableError extends AppException {
  constructor(
    readonly reason: 'disabled' | 'budget' | 'no_key' | 'provider',
    message: string,
  ) {
    super('SERVICE_UNAVAILABLE', message);
  }
}
