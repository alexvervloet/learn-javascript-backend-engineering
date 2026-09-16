/**
 * Boyce-Codd Normal Form (BCNF)
 * ==============================
 * Rule: for every non-trivial dependency X → Y, X must be a superkey. 3NF allows
 * a loophole (Y may be a prime attribute even if X isn't a superkey); BCNF closes it.
 *
 * Scenario: each advisor covers exactly one subject.
 *   student_advisors(student_id, subject, advisor_id)
 *   advisor_id → subject, but advisor_id alone is not a superkey → 3NF but not BCNF.
 * Fix: split out advisor_subjects(advisor_id PK, subject).
 *
 * Run: npx tsx 05_bcnf.ts
 */

import * as db from "./db.js";

async function main() {
  await db.query(`
    DROP TABLE IF EXISTS bcnf_student_advisors_3nf;
    CREATE TABLE bcnf_student_advisors_3nf (student_id INT, subject TEXT, advisor_id INT, PRIMARY KEY (student_id, subject));
    INSERT INTO bcnf_student_advisors_3nf VALUES (1,'Mathematics',10),(1,'Physics',20),(2,'Mathematics',10),(2,'Chemistry',30),(3,'Physics',20);
  `);

  console.log("=".repeat(60));
  console.log("BOYCE-CODD NORMAL FORM (BCNF)");
  console.log("=".repeat(60));
  console.log("\n--- In 3NF but NOT BCNF ---");
  await db.printTable("SELECT * FROM bcnf_student_advisors_3nf ORDER BY student_id, subject", ["student_id", "subject", "advisor_id"]);
  console.log("FD violation: advisor_id → subject, but advisor_id is not a superkey.");
  console.log("Advisor 10 carries 'Mathematics' on multiple rows:");
  await db.printTable("SELECT * FROM bcnf_student_advisors_3nf WHERE advisor_id = 10", ["student_id", "subject", "advisor_id"]);
  console.log("Anomaly: reassigning advisor 10's subject means updating N rows.\n");

  await db.query(`
    DROP TABLE IF EXISTS bcnf_student_advisors; DROP TABLE IF EXISTS bcnf_advisor_subjects;
    CREATE TABLE bcnf_advisor_subjects (advisor_id INT PRIMARY KEY, subject TEXT NOT NULL);
    CREATE TABLE bcnf_student_advisors (student_id INT, advisor_id INT REFERENCES bcnf_advisor_subjects, PRIMARY KEY (student_id, advisor_id));
    INSERT INTO bcnf_advisor_subjects VALUES (10,'Mathematics'),(20,'Physics'),(30,'Chemistry');
    INSERT INTO bcnf_student_advisors VALUES (1,10),(1,20),(2,10),(2,30),(3,20);
  `);

  console.log("--- BCNF decomposition ---");
  console.log("  bcnf_advisor_subjects (advisor_id PK — a superkey for advisor_id → subject):");
  await db.printTable("SELECT * FROM bcnf_advisor_subjects ORDER BY advisor_id", ["advisor_id", "subject"]);
  console.log("  bcnf_student_advisors (enrolment facts only):");
  await db.printTable("SELECT * FROM bcnf_student_advisors ORDER BY student_id, advisor_id", ["student_id", "advisor_id"]);
  console.log("IMPROVEMENT — reassigning advisor 10's subject is now exactly ONE row.\n");

  console.log("Summary:");
  console.log("  0NF→1NF: remove multi-valued/non-atomic columns");
  console.log("  1NF→2NF: remove partial dependencies on a composite key");
  console.log("  2NF→3NF: remove transitive dependencies (A → B → C)");
  console.log("  3NF→BCNF: remove FDs whose determinant isn't a superkey");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
