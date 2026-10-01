# Course needs persistence v1

## Scope

This checkpoint makes `/mi-curso` needs persistent without coupling them yet to
`saved_searches` or `demand_requests`.

## Production schema

- `course_needs.owner_user_id -> profiles.id ON DELETE CASCADE`
- `course_needs.student_id -> account_students.id ON DELETE CASCADE`
- server-derived `academic_year`
- statuses: `active | fulfilled | archived`
- authenticated clients have SELECT only
- own-row RLS by `owner_user_id`
- writes go through server API only

Applied Supabase migrations:

- `20261001204816_course_needs_foundation`
- `20261001204851_course_needs_student_fk_index`

## API

- `GET /api/my-course/needs`
- `POST /api/my-course/needs`
- `DELETE /api/my-course/needs/:id`

Delete archives a need instead of destroying history.

## Compatibility

The first server-persistent visit to Mi curso can import the previous
`wetudy_my_course_v1:<userId>` browser state through the same authenticated API.
The local copy is removed only after every importable need was created or already
recognized as a duplicate.

## Rollback

The application can be rolled back independently because the new table is additive.
While unused by older code, leaving `course_needs` in place has no effect on
existing Marketplace, account, chat, demand or saved-search flows.
