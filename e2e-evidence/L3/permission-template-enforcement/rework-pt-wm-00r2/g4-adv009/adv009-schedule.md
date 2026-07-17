# ADV-PT-009 schedule (DRY-RUN plan, 20 rounds)

## Round 1 (seed=0xcafe0001)
- expected: all-deny
- operations:
  - 1. mutate_session → session-B
  - 2. mutate_agent → session-C
  - 3. mutate_canonical_scope → session-A
  - 4. mutate_required_list → session-B
  - 5. mutate_file_hash → session-C
- assertions: ORA-PT-11, ORA-PT-12

## Round 2 (seed=0xcafe0002)
- expected: all-deny
- operations:
  - 1. mutate_session → session-C
  - 2. mutate_agent → session-A
  - 3. mutate_canonical_scope → session-B
  - 4. mutate_required_list → session-C
  - 5. mutate_file_hash → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 3 (seed=0xcafe0003)
- expected: all-deny
- operations:
  - 1. mutate_session → session-A
  - 2. mutate_agent → session-B
  - 3. mutate_canonical_scope → session-C
  - 4. mutate_required_list → session-A
  - 5. mutate_file_hash → session-B
- assertions: ORA-PT-11, ORA-PT-12

## Round 4 (seed=0xcafe0004)
- expected: all-deny
- operations:
  - 1. mutate_session → session-B
  - 2. mutate_agent → session-C
  - 3. mutate_canonical_scope → session-A
  - 4. mutate_required_list → session-B
  - 5. mutate_file_hash → session-C
- assertions: ORA-PT-11, ORA-PT-12

## Round 5 (seed=0xcafe0005)
- expected: all-deny
- operations:
  - 1. mutate_session → session-C
  - 2. mutate_agent → session-A
  - 3. mutate_canonical_scope → session-B
  - 4. mutate_required_list → session-C
  - 5. mutate_file_hash → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 6 (seed=0xcafe0006)
- expected: all-deny
- operations:
  - 1. db_read_error → session-A
  - 2. db_write_error → session-B
  - 3. corrupt_state → session-C
  - 4. lock_conflict → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 7 (seed=0xcafe0007)
- expected: all-deny
- operations:
  - 1. db_read_error → session-A
  - 2. db_write_error → session-B
  - 3. corrupt_state → session-C
  - 4. lock_conflict → session-B
- assertions: ORA-PT-11, ORA-PT-12

## Round 8 (seed=0xcafe0008)
- expected: all-deny
- operations:
  - 1. db_read_error → session-A
  - 2. db_write_error → session-B
  - 3. corrupt_state → session-C
  - 4. lock_conflict → session-C
- assertions: ORA-PT-11, ORA-PT-12

## Round 9 (seed=0xcafe0009)
- expected: all-deny
- operations:
  - 1. db_read_error → session-A
  - 2. db_write_error → session-B
  - 3. corrupt_state → session-C
  - 4. lock_conflict → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 10 (seed=0xcafe000a)
- expected: all-deny
- operations:
  - 1. db_read_error → session-A
  - 2. db_write_error → session-B
  - 3. corrupt_state → session-C
  - 4. lock_conflict → session-B
- assertions: ORA-PT-11, ORA-PT-12

## Round 11 (seed=0xcafe000b)
- expected: winner-only
- operations:
  - 1. interleave_attestation → all
  - 2. parallel_attestation → all
  - 3. repeated_attestation → session-C
- assertions: ORA-PT-11, ORA-PT-12

## Round 12 (seed=0xcafe000c)
- expected: winner-only
- operations:
  - 1. interleave_attestation → all
  - 2. parallel_attestation → all
  - 3. repeated_attestation → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 13 (seed=0xcafe000d)
- expected: winner-only
- operations:
  - 1. interleave_attestation → all
  - 2. parallel_attestation → all
  - 3. repeated_attestation → session-B
- assertions: ORA-PT-11, ORA-PT-12

## Round 14 (seed=0xcafe000e)
- expected: winner-only
- operations:
  - 1. interleave_attestation → all
  - 2. parallel_attestation → all
  - 3. repeated_attestation → session-C
- assertions: ORA-PT-11, ORA-PT-12

## Round 15 (seed=0xcafe000f)
- expected: winner-only
- operations:
  - 1. interleave_attestation → all
  - 2. parallel_attestation → all
  - 3. repeated_attestation → session-A
- assertions: ORA-PT-11, ORA-PT-12

## Round 16 (seed=0xcafe0010)
- expected: no-amplification
- operations:
  - 1. mutate_session → session-A
  - 2. db_read_error → session-B
  - 3. interleave_attestation → all
  - 4. mutate_canonical_scope → session-C
  - 5. corrupt_state → session-A
  - 6. parallel_attestation → all
- assertions: ORA-PT-11, ORA-PT-12

## Round 17 (seed=0xcafe0011)
- expected: no-amplification
- operations:
  - 1. mutate_session → session-A
  - 2. db_read_error → session-B
  - 3. interleave_attestation → all
  - 4. mutate_canonical_scope → session-C
  - 5. corrupt_state → session-A
  - 6. parallel_attestation → all
- assertions: ORA-PT-11, ORA-PT-12

## Round 18 (seed=0xcafe0012)
- expected: no-amplification
- operations:
  - 1. mutate_session → session-A
  - 2. db_read_error → session-B
  - 3. interleave_attestation → all
  - 4. mutate_canonical_scope → session-C
  - 5. corrupt_state → session-A
  - 6. parallel_attestation → all
- assertions: ORA-PT-11, ORA-PT-12

## Round 19 (seed=0xcafe0013)
- expected: no-amplification
- operations:
  - 1. mutate_session → session-A
  - 2. db_read_error → session-B
  - 3. interleave_attestation → all
  - 4. mutate_canonical_scope → session-C
  - 5. corrupt_state → session-A
  - 6. parallel_attestation → all
- assertions: ORA-PT-11, ORA-PT-12

## Round 20 (seed=0xcafe0014)
- expected: no-amplification
- operations:
  - 1. mutate_session → session-A
  - 2. db_read_error → session-B
  - 3. interleave_attestation → all
  - 4. mutate_canonical_scope → session-C
  - 5. corrupt_state → session-A
  - 6. parallel_attestation → all
- assertions: ORA-PT-11, ORA-PT-12
