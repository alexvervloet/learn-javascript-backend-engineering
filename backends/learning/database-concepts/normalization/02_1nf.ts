/**
 * First Normal Form (1NF)
 * =======================
 * Satisfied: every column is atomic; rows have a primary key (student_id, course_id).
 * Remaining problems → 2NF: partial dependencies (student_name depends only on
 * student_id; course_name only on course_id) cause update/deletion/insertion anomalies.
 *
 * Run: npx tsx 02_1nf.ts
 */

import * as db from "./db.js";

async function main() {
  await db.query(`
    DROP TABLE IF EXISTS nf1_registration;
    CREATE TABLE nf1_registration (
      student_id INT, student_name TEXT, student_email TEXT,
      course_id VARCHAR(10), course_name TEXT, instructor TEXT, instructor_dept TEXT,
      grade CHAR(2), PRIMARY KEY (student_id, course_id)
    );
    INSERT INTO nf1_registration VALUES
      (1,'Alice Smith','alice@uni.edu','CS101','Intro to CS','Dr. Patel','Computer Science','A'),
      (1,'Alice Smith','alice@uni.edu','MATH101','Calculus I','Dr. Lee','Mathematics','B+'),
      (1,'Alice Smith','alice@uni.edu','BIO301','Cell Biology','Dr. Nguyen','Biology','B'),
      (2,'Bob Jones','bob@uni.edu','CS101','Intro to CS','Dr. Patel','Computer Science','B'),
      (2,'Bob Jones','bob@uni.edu','ENG201','Tech Writing','Dr. Kim','English','A-'),
      (3,'Carol White','carol@uni.edu','MATH101','Calculus I','Dr. Lee','Mathematics','A+');
  `);

  console.log("=".repeat(60));
  console.log("FIRST NORMAL FORM (1NF)");
  console.log("=".repeat(60));
  console.log("\n--- Table (PK: student_id + course_id) ---");
  await db.printTable("SELECT * FROM nf1_registration ORDER BY student_id, course_id", ["student_id", "student_name", "student_email", "course_id", "course_name", "instructor", "instructor_dept", "grade"]);

  console.log("IMPROVEMENT over 0NF — finding CS101 students is a clean equality filter:");
  await db.printTable("SELECT student_id, student_name, grade FROM nf1_registration WHERE course_id = 'CS101'", ["student_id", "student_name", "grade"]);

  console.log("PROBLEM 1 — partial dependency / update anomaly: Alice's email is stored 3×;");
  console.log("            changing it touches 3 rows for one logical change.");
  console.log("PROBLEM 2 — deletion anomaly: deleting Carol's only enrollment loses her contact info.");
  console.log("PROBLEM 3 — insertion anomaly: a new course can't exist until a student enrolls.\n");
  console.log("Fix: decompose into separate tables — see 03_2nf.ts");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
