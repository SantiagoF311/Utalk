# Arquitectura interna del backend

Cómo se organiza el código dentro de `apps/backend`, a nivel de módulo —
distinto de [backend-y-colas.md](./backend-y-colas.md), que cubre qué
tecnologías usa el backend (NestJS, BullMQ, hosting). Este documento
cubre cómo se estructuran los archivos y las dependencias entre capas
dentro de cada módulo de dominio.

## Decisión: monolito modular con arquitectura hexagonal / Clean Architecture

El backend es un monolito (no microservicios — ver
[decisiones-descartadas.md](./decisiones-descartadas.md)), pero cada
módulo de dominio se escribe de forma que **pueda extraerse a un
microservicio independiente más adelante sin reescribir su lógica de
negocio** — solo cambiando el adaptador de infraestructura.

Hexagonal (Ports & Adapters, Cockburn) y Clean Architecture (Robert C.
Martin) son, en la práctica, el mismo principio con distinta
nomenclatura: la lógica de negocio no debe depender de detalles técnicos
(Supabase, HTTP, BullMQ) — el dominio define **puertos** (interfaces) y
la infraestructura provee **adaptadores** que los implementan. La regla
que hace esto funcionar (la "Dependency Rule" de Clean Architecture):
**el código de `domain/` nunca importa nada de `infrastructure/`** — la
dirección de dependencia siempre apunta hacia adentro.

## Nivel de rigor elegido: 3 conceptos, no las 4 capas completas

Clean Architecture "de libro" define 4 capas (Entities, Use Cases,
Interface Adapters, Frameworks & Drivers). En la práctica de la
industria, para APIs de este tamaño (no un proyecto enterprise con
equipos grandes), es común colapsar `application/` y `presentation/` en
el `service`/`controller` estándar de Nest, sin perder el desacople real
(que viene de separar `domain/` de `infrastructure/`).

Estructura elegida por módulo:

```
apps/backend/src/modules/<dominio>/
├── domain/
│   ├── <dominio>.entity.ts        # clase con métodos (no un tipo plano)
│   └── <dominio>.repository.ts     # el puerto: interface, sin implementación
├── infrastructure/
│   └── supabase-<dominio>.repository.ts  # el adaptador: implementa el puerto con Supabase
├── <dominio>.service.ts            # casos de uso (equivalente a application/)
├── <dominio>.view.ts               # entidad → lo que sale por la red (schema de @utalk/shared)
├── <dominio>.controller.ts         # rutas HTTP (equivalente a presentation/)
└── <dominio>.module.ts             # cablea todo vía DI de Nest
```

**Cuándo partir `<dominio>.service.ts` en varios `*.use-case.ts`
separados** (recién ahí formalizar una carpeta `application/`): cuando
el service acumule muchos métodos con lógica compleja e independiente
entre sí y se vuelva difícil de navegar como un solo archivo — no de
entrada, por dogma.

## Entities: clases con métodos, no tipos planos

Se eligió representar las Entities de dominio (`Post`, `Profile`, etc.)
como clases con comportamiento propio, no como los tipos inferidos de
Zod (`type Post = z.infer<typeof postSchema>`) usados directamente.

```ts
// domain/post.entity.ts
export class Post {
  constructor(
    readonly id: string,
    readonly communityId: string,
    readonly authorId: string,
    readonly title: string,
    readonly body: string,
    readonly createdAt: Date,
  ) {}

  isEditableBy(userId: string): boolean {
    return this.authorId === userId;
  }
}
```

**Por qué clase y no tipo plano**: reglas de negocio que dependen del
propio dato (ej. "quién puede editar este post", cálculos de
antigüedad para trending) viven en un solo lugar, en vez de reescribirse
en cada sitio del código que las necesite. Elegido conscientemente por
valor de aprendizaje del patrón completo, aunque un tipo plano hubiera
sido suficiente para reglas triviales.

**Distinción con los schemas de `packages/shared`**: los schemas Zod
(`postSchema`, etc.) son el contrato de datos que cruza la red
(backend ↔ mobile) — no tienen métodos, son estructura pura. La Entity
es un concepto interno del backend, nunca cruza la red. El
`infrastructure/supabase-<dominio>.repository.ts` es responsable de
convertir entre la fila cruda de Supabase (snake_case) y una instancia
real de la Entity.

## Vistas: lo que sale por la red

Los controllers **nunca devuelven una Entity**. Nest serializa a JSON
cualquier objeto que devuelva un controller, con todos sus campos: si se
devolviera la Entity, cualquier campo que se le agregue aparecería solo en
la API, sin que nadie lo decida. Así se filtró `profiles.role` en
`GET /profiles/:id` antes de adoptar este patrón.

Cada módulo tiene un `<dominio>.view.ts` con funciones puras que convierten
la Entity al schema de `@utalk/shared` que es el contrato con el cliente
(`toCommunityView(community): Community`). La vista decide explícitamente qué campos
se exponen y adapta el formato (ej. `Date` → string ISO).

**Dónde se arma la vista**:

- **En el controller**, si la Entity ya trae todo lo que la vista muestra
  (comunidades, paneles, universidades, reportes, votos): solo se traduce.
- **En el service**, si armarla requiere consultar o combinar datos que la
  Entity no tiene (posts y comentarios: el autor con su universidad y el
  voto de quien mira; comentarios, además, el árbol de respuestas; perfil
  público: la universidad). El service expone entonces dos métodos: uno
  que devuelve la vista, para el controller (`findViewById`), y otro que
  devuelve la Entity, para otros módulos del backend (`findById`). Las
  vistas van hacia afuera; las Entities se quedan adentro.

**Colecciones**: toda respuesta que es una lista va envuelta en
`{ items: [...] }` (`listSchema` / `List<T>` en shared), aunque hoy no
pagine; las paginadas agregan `nextCursor`. Con un array suelto, agregar
paginación después rompería a los clientes; con el objeto, solo se agrega
un campo.

**Parámetros de ruta**: todo id en la URL se valida con `ParseUUIDPipe`;
un id mal formado responde 400 en vez de llegar a Postgres y terminar en
500.

## Comunicación entre módulos: inyección directa, no eventos genéricos

Cuando un módulo necesita un dato de otro **dentro del mismo request**
(ej. `PostsModule` necesita el `university_id` del autor, que vive en
`ProfilesModule`, para validar en qué comunidades puede postear), la
comunicación es una **llamada directa e inyectada** — el patrón estándar
de Nest (`PostsModule` importa `ProfilesModule`, inyecta
`ProfilesService` en su constructor), no un event emitter genérico
(`@nestjs/event-emitter`) ni una cola.

**Por qué no eventos para este caso**: los eventos genéricos son útiles
cuando el productor no necesita ni debería saber quiénes son todos los
consumidores posibles, típicamente para reacciones opcionales a algo que
ya pasó. El caso de `PostsModule` necesitando el `university_id` del
autor es una **pregunta que necesita respuesta síncrona, ahora, para
poder continuar** — no una notificación fire-and-forget. Forzar eventos
ahí sería complejidad sin beneficio real.

**Por qué esto no compite con BullMQ**: las colas (ver
[backend-y-colas.md](./backend-y-colas.md)) siguen siendo el mecanismo
para lo que ya se definió como asíncrono (notificaciones, moderación,
recálculo de trending) — ahí el productor **sí** nombra la cola
explícitamente (`queue.add('notify-subscribers', ...)`), no es un evento
genérico tampoco. La inyección directa cubre un caso distinto:
comunicación síncrona dentro del mismo request.

**Costo de extraer un módulo a microservicio más adelante**: bajo,
porque la firma del método inyectado (`profilesService.findById(id):
Promise<Profile>`) no cambia — solo cambia qué hay detrás de esa llamada
(de una consulta local a Postgres, a una llamada HTTP/gRPC a otro
servicio). El código que la llama no se entera del cambio.

## Ejemplo de flujo completo

```ts
// domain/post.repository.ts — el puerto
export interface PostRepository {
  create(post: NewPost): Promise<Post>;
  findById(id: string): Promise<Post | null>;
}

// posts.service.ts — caso de uso, orquesta entity + repository + otros módulos
@Injectable()
export class PostsService {
  constructor(
    @Inject('PostRepository') private readonly postRepository: PostRepository,
    private readonly profilesService: ProfilesService, // inyección directa
  ) {}

  async create(input: CreatePostInput, authorId: string): Promise<Post> {
    const author = await this.profilesService.findById(authorId);
    // ... reglas de negocio ...
    return this.postRepository.create({ ...input, authorId });
  }
}

// infrastructure/supabase-post.repository.ts — el adaptador
@Injectable()
export class SupabasePostRepository implements PostRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async create(post: NewPost): Promise<Post> {
    const { data, error } = await this.supabase.client
      .from('posts')
      .insert(post)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return new Post(data.id, data.community_id, data.author_id, data.title, data.body, new Date(data.created_at));
  }
}

// posts.module.ts — cablea el puerto con el adaptador concreto
@Module({
  imports: [ProfilesModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    { provide: 'PostRepository', useClass: SupabasePostRepository },
  ],
})
export class PostsModule {}
```
