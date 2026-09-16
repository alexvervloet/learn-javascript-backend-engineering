/**
 * 04 · Types — Concepts
 * ======================
 *
 * --- ENUMS ---
 * SDL: `enum Genre { FICTION NON_FICTION SCIENCE HISTORY }`. On the wire an enum
 * serializes to its value name ("NON_FICTION"). By default graphql-js uses the
 * name as the internal value too; supply a resolver map under the enum name to
 * map names to different internal values.
 *
 * --- CUSTOM SCALARS ---
 * For types GraphQL doesn't ship (Date, UUID, JSON), build a GraphQLScalarType:
 *   new GraphQLScalarType({
 *     name: "Date",
 *     serialize:     (value) => value.toISOString().slice(0, 10),  // out to client
 *     parseValue:    (value) => new Date(value),                   // from variables
 *     parseLiteral:  (ast)  => new Date(ast.value),                // from inline literals
 *   })
 * Wire it under its name in the resolvers map: `{ Date: dateScalar }`.
 *
 * --- INTERFACES ---
 * `interface Publishable { title: String! status: PublishStatus! }`. A type
 * implements it with `type Article implements Node & Publishable { ... }` and
 * must declare all the interface's fields.
 *
 * --- UNIONS ---
 * `union SearchResult = Article | Video` — a field returns one of several types.
 * Clients pick fields with inline fragments:
 *   { search(term:"x") { __typename ... on Article { body } ... on Video { url } } }
 *
 * --- __resolveType ---
 * Abstract types (unions/interfaces returned by a field) need a `__resolveType`
 * so the executor knows each value's concrete type. Here each data row carries a
 * `kind` tag and `SearchResult.__resolveType = (obj) => obj.kind`.
 *
 * --- EXERCISES ---
 * 1. Add a HISTORY article and filter with articlesByGenre(genre: HISTORY).
 * 2. Add a JSON custom scalar (serialize/parseValue = identity).
 * 3. Add Podcast to the union and its __resolveType branch.
 * 4. Query an interface field on both Article and Video without a fragment.
 */

const ABSTRACT_TYPES = {
  interface: "shared fields a type must implement; use `implements A & B`",
  union: "one of several object types; members share no fields",
  __resolveType: "(value) => concrete type name — required for both",
};

export { ABSTRACT_TYPES };
