/**
 * Third Normal Form (3NF)
 * =======================
 * Satisfied: 2NF + no transitive dependencies — every non-key column depends
 * directly on its table's primary key. Instructors moved to their own table;
 * courses reference instructor_id. For most production schemas, 3NF is the target.
 *
 * Run: npx tsx 04_3nf.ts
 */

import * as db from "./db.js";

async function main() {
  await db.query(`
    DROP TABLE IF EXISTS nf3_enrollments; DROP TABLE IF EXISTS nf3_courses; DROP TABLE IF EXISTS nf3_instructors; DROP TABLE IF EXISTS nf3_students;
    CREATE TABLE nf3_students (student_id INT PRIMARY KEY, student_name TEXT NOT NULL, student_email TEXT NOT NULL);
    CREATE TABLE nf3_instructors (instructor_id SERIAL PRIMARY KEY, instructor_name TEXT NOT NULL, instructor_dept TEXT NOT NULL);
    CREATE TABLE nf3_courses (course_id VARCHAR(10) PRIMARY KEY, course_name TEXT NOT NULL, instructor_id INT NOT NULL REFERENCES nf3_instructors);
    CREATE TABLE nf3_enrollments (student_id INT REFERENCES nf3_students, course_id VARCHAR(10) REFERENCES nf3_courses, grade CHAR(2), PRIMARY KEY (student_id, course_id));
    INSERT INTO nf3_students VALUES (1,'Alice Smith','alice@uni.edu'),(2,'Bob Jones','bob@uni.edu'),(3,'Carol White','carol@uni.edu');
    INSERT INTO nf3_instructors (instructor_name, instructor_dept) VALUES ('Dr. Patel','Computer Science'),('Dr. Lee','Mathematics'),('Dr. Kim','English'),('Dr. Nguyen','Biology');
    INSERT INTO nf3_courses VALUES ('CS101','Intro to CS',1),('CS201','Data Structs',1),('MATH101','Calculus I',2),('ENG201','Tech Writing',3),('BIO301','Cell Biology',4);
    INSERT INTO nf3_enrollments VALUES (1,'CS101','A'),(1,'MATH101','B+'),(1,'BIO301','B'),(2,'CS101','B'),(2,'ENG201','A-'),(3,'MATH101','A+');
  `);

  console.log("=".repeat(60));
  console.log("THIRD NORMAL FORM (3NF)");
  console.log("=".repeat(60));
  console.log("\n--- nf3_instructors (dept lives here only) ---");
  await db.printTable("SELECT * FROM nf3_instructors ORDER BY instructor_id", ["instructor_id", "instructor_name", "instructor_dept"]);
  console.log("--- nf3_courses (reference instructor_id) ---");
  await db.printTable("SELECT * FROM nf3_courses ORDER BY course_id", ["course_id", "course_name", "instructor_id"]);

  console.log("IMPROVEMENT over 2NF — Dr. Patel changes department in exactly ONE row.\n");
  console.log("--- Full enrolment report (JOIN across four tables) ---");
  await db.printTable(
    `SELECT s.student_name, c.course_name, i.instructor_name, i.instructor_dept, e.grade
     FROM nf3_enrollments e
     JOIN nf3_students s ON s.student_id = e.student_id
     JOIN nf3_courses c ON c.course_id = e.course_id
     JOIN nf3_instructors i ON i.instructor_id = c.instructor_id
     ORDER BY s.student_name, c.course_name`,
    ["student", "course", "instructor", "department", "grade"]
  );
  console.log("For most schemas, 3NF is the right stopping point. BCNF matters with");
  console.log("overlapping candidate keys — see 05_bcnf.ts");
  await db.close();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
