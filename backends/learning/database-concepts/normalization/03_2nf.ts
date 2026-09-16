/**
 * Second Normal Form (2NF)
 * ========================
 * Satisfied: 1NF + no partial dependencies — every non-key column depends on the
 * WHOLE primary key. Students and courses moved into their own tables; enrollments
 * holds only the grade (which truly needs both keys).
 * Remaining problem → 3NF: a transitive dependency in courses
 * (course_id → instructor → instructor_dept).
 *
 * Run: npx tsx 03_2nf.ts
 */

import * as db from "./db.js";

async function main() {
  await db.query(`
    DROP TABLE IF EXISTS nf2_enrollments; DROP TABLE IF EXISTS nf2_courses; DROP TABLE IF EXISTS nf2_students;
    CREATE TABLE nf2_students (student_id INT PRIMARY KEY, student_name TEXT NOT NULL, student_email TEXT NOT NULL);
    CREATE TABLE nf2_courses (course_id VARCHAR(10) PRIMARY KEY, course_name TEXT NOT NULL, instructor TEXT NOT NULL, instructor_dept TEXT NOT NULL);
    CREATE TABLE nf2_enrollments (student_id INT REFERENCES nf2_students, course_id VARCHAR(10) REFERENCES nf2_courses, grade CHAR(2), PRIMARY KEY (student_id, course_id));
    INSERT INTO nf2_students VALUES (1,'Alice Smith','alice@uni.edu'),(2,'Bob Jones','bob@uni.edu'),(3,'Carol White','carol@uni.edu');
    INSERT INTO nf2_courses VALUES ('CS101','Intro to CS','Dr. Patel','Computer Science'),('CS201','Data Structs','Dr. Patel','Computer Science'),('MATH101','Calculus I','Dr. Lee','Mathematics'),('ENG201','Tech Writing','Dr. Kim','English'),('BIO301','Cell Biology','Dr. Nguyen','Biology');
    INSERT INTO nf2_enrollments VALUES (1,'CS101','A'),(1,'MATH101','B+'),(1,'BIO301','B'),(2,'CS101','B'),(2,'ENG201','A-'),(3,'MATH101','A+');
  `);

  console.log("=".repeat(60));
  console.log("SECOND NORMAL FORM (2NF)");
  console.log("=".repeat(60));
  console.log("\n--- nf2_students ---");
  await db.printTable("SELECT * FROM nf2_students ORDER BY student_id", ["student_id", "student_name", "student_email"]);
  console.log("--- nf2_courses ---");
  await db.printTable("SELECT * FROM nf2_courses ORDER BY course_id", ["course_id", "course_name", "instructor", "instructor_dept"]);
  console.log("--- nf2_enrollments ---");
  await db.printTable("SELECT * FROM nf2_enrollments ORDER BY student_id, course_id", ["student_id", "course_id", "grade"]);

  console.log("IMPROVEMENT over 1NF — Alice's email lives in one row; Carol survives unenrolment.\n");
  console.log("PROBLEM — transitive dependency: Dr. Patel teaches two courses, dept stored twice:");
  await db.printTable("SELECT course_id, instructor, instructor_dept FROM nf2_courses WHERE instructor = 'Dr. Patel'", ["course_id", "instructor", "instructor_dept"]);
  console.log("  Chain: course_id → instructor → instructor_dept. Fix: see 04_3nf.ts");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
