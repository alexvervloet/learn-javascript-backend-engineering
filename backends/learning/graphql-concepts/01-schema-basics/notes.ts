/**
 * 01 · Schema Basics — Concepts & Query Reference
 * ================================================
 *
 * --- GRAPHQL vs REST ---
 * REST: the server decides the response shape.
 *   GET /books/1 → { id, title, author, year, description }
 * GraphQL: the CLIENT decides which fields it needs.
 *   { book(id: "1") { title year } } → { book: { title, year } }
 * No over-fetching, no under-fetching, multiple resources in one request.
 *
 * --- SDL (Schema Definition Language) ---
 * In schema-first JS you write the SDL directly (see schema.ts):
 *   type Book { id: ID!  title: String!  description: String }
 *   type Query { books: [Book!]!  book(id: ID!): Book }
 *   type Mutation { addBook(input: AddBookInput!): Book! }
 * The `!` means non-nullable; fields without `!` may return null.
 *
 * --- THE TYPE SYSTEM ---
 * Built-in scalars (leaf types): String, Int, Float, Boolean, ID.
 * JS → GraphQL is your choice in SDL; graphql-js coerces JS values:
 *   string → String   number → Int/Float   boolean → Boolean   string → ID
 *   nullable: drop the `!`        list: [T!]!
 * Custom scalars: new GraphQLScalarType({ serialize, parseValue }) — see 04.
 *
 * --- QUERIES ---
 *   { books { id title } }                  basic selection
 *   { book(id: "2") { title } }             with arguments
 *   { a: book(id:"1"){title} b: book(id:"2"){title} }   aliases
 *   query GetBook($id: ID!) { book(id:$id){title} }      variables (the real way)
 *   fragment BookFields on Book { id title }            reusable selections
 *
 * --- MUTATIONS ---
 *   mutation { addBook(input: { title:"DDIA", author:"K", year:2017 }) { id } }
 *   mutation AddBook($input: AddBookInput!) { addBook(input:$input) { id } }
 *
 * --- INTROSPECTION ---
 *   { __schema { types { name kind } } }
 *   { __type(name: "Book") { fields { name } } }
 * The playground's autocomplete and docs use introspection automatically.
 *
 * --- EXERCISES ---
 * 1. Query all books, requesting only id and title.
 * 2. Query a missing id ("999") — the field returns null, not an error.
 * 3. Add a book with addBook; request id, title, author back.
 * 4. Delete it; deleting a missing id returns false.
 * 5. Print the SDL: node -e "console.log(require('@graphql-tools/schema')) ..."
 *    or use printSchema(require('./schema').schema) from "graphql".
 * 6. Use an alias to fetch two books in one request.
 */

const SCALAR_TYPES = {
  String: "UTF-8 text",
  Int: "32-bit integer",
  Float: "64-bit float",
  Boolean: "true / false",
  ID: "Opaque identifier — serialized as String",
};

const KEY_PIECES = {
  typeDefs: "SDL string describing types, queries, mutations",
  resolvers: "Map of type → field → resolver function",
  makeExecutableSchema: "Stitches typeDefs + resolvers into a runnable schema",
  "graphql / graphqlSync": "Execute a query against the schema (no server needed)",
};

export { SCALAR_TYPES, KEY_PIECES };
