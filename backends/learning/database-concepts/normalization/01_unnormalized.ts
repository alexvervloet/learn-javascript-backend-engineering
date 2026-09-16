/**
 * Unnormalized Form (0NF)
 * =======================
 * Problems: multi-valued columns (comma-separated courses/grades — not atomic),
 * update anomalies (renaming a course means editing text inside a cell), and no
 * reliable primary key (one student spread across rows).
 *
 * Domain: university course registration. Run: npx tsx 01_unnormalized.ts
 */

import * as db from "./db.js";

async function main() {
  await db.query(`
    DROP TABLE IF EXISTS unnorm_registration;
    CREATE TABLE unnorm_registration (
      student_id INT, student_name TEXT, student_email TEXT,
      courses TEXT,  -- 'CS101, MATH101'  (NOT atomic)
      grades TEXT    -- 'A, B+'           (NOT atomic)
    );
    INSERT INTO unnorm_registration VALUES
      (1,'Alice Smith','alice@uni.edu','CS101, MATH101','A, B+'),
      (2,'Bob Jones','bob@uni.edu','CS101, ENG201, BIO301','B, A-, A'),
      (3,'Carol White','carol@uni.edu','MATH101','A+'),
      (1,'Alice Smith','alice@uni.edu','BIO301','B');
  `);

  console.log("=".repeat(60));
  console.log("UNNORMALIZED FORM (0NF)");
  console.log("=".repeat(60));
  console.log("\n--- Raw table ---");
  await db.printTable("SELECT * FROM unnorm_registration ORDER BY student_id", ["student_id", "student_name", "student_email", "courses", "grades"]);

  console.log("PROBLEM 1 — multi-valued columns: finding CS101 students needs a fragile LIKE:");
  await db.printTable("SELECT student_id, student_name, courses FROM unnorm_registration WHERE courses LIKE '%CS101%'", ["student_id", "student_name", "courses"]);

  console.log("PROBLEM 2 — update anomaly: renaming 'CS101' means REPLACE() inside a text cell.\n");
  console.log("PROBLEM 3 — no reliable PK: Alice (id=1) appears on two rows:");
  await db.printTable("SELECT student_id, student_name, courses FROM unnorm_registration WHERE student_id = 1", ["student_id", "student_name", "courses"]);

  console.log("Fix: move to 1NF — see 02_1nf.ts");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
