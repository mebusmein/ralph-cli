/**
 * Generic Result type for operations that can succeed or fail
 *
 * This is a discriminated union pattern that provides type-safe error handling
 * without throwing exceptions. The `success` field acts as a type guard.
 *
 * @example
 * // For operations that return data on success:
 * type MyResult = Result<{ data: string }, { type: 'not_found' | 'invalid'; message: string }>;
 *
 * function doSomething(): MyResult {
 *   if (success) {
 *     return { success: true, data: 'hello' };
 *   }
 *   return { success: false, error: { type: 'not_found', message: 'Item not found' } };
 * }
 *
 * const result = doSomething();
 * if (result.success) {
 *   console.log(result.data); // TypeScript knows this is safe
 * } else {
 *   console.error(result.error.message); // TypeScript knows this is safe
 * }
 *
 * @example
 * // For operations that don't return data on success:
 * type VoidResult = Result<Record<string, never>, MyError>;
 *
 * function doAction(): VoidResult {
 *   if (success) {
 *     return { success: true };
 *   }
 *   return { success: false, error: { message: 'Failed' } };
 * }
 */
export type Result<T, E> =
	| ({success: true} & T)
	| {success: false; error: E};

/**
 * Helper type to extract the success value type from a Result
 */
export type SuccessValue<R> = R extends {success: true} & infer T ? T : never;

/**
 * Helper type to extract the error type from a Result
 */
export type ErrorValue<R> = R extends {success: false; error: infer E}
	? E
	: never;
