"""
Management command: seed_categories
Populates all predefined event categories with icon, color, and description.
Usage: python manage.py seed_categories
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.events.models import Category

CATEGORIES = [
    {
        "name": "Festa / Balada",
        "icon": "🎉",
        "color_hex": "#EC4899",
        "description": "Festas, baladas, bares e noitadas.",
    },
    {
        "name": "Feirinha de Rua / Mercado",
        "icon": "🛍️",
        "color_hex": "#F97316",
        "description": "Feiras de artesanato, mercados locais e feirinhas de rua.",
    },
    {
        "name": "Cultural",
        "icon": "🎭",
        "color_hex": "#8B5CF6",
        "description": "Teatro, exposições, cinema, museus e eventos culturais.",
    },
    {
        "name": "Esporte",
        "icon": "🏃",
        "color_hex": "#10B981",
        "description": "Corridas, ciclismo, esportes ao ar livre e treinos coletivos.",
    },
    {
        "name": "Show / Música ao Vivo",
        "icon": "🎵",
        "color_hex": "#3B82F6",
        "description": "Shows, concertos, jam sessions e apresentações musicais.",
    },
    {
        "name": "Gastronomia",
        "icon": "🍺",
        "color_hex": "#EAB308",
        "description": "Food festivals, degustações, bares e eventos gastronômicos.",
    },
    {
        "name": "Natureza / Outdoor",
        "icon": "🌿",
        "color_hex": "#22C55E",
        "description": "Trilhas, ecoturismo, camping e atividades na natureza.",
    },
    {
        "name": "Educacional",
        "icon": "🎓",
        "color_hex": "#6366F1",
        "description": "Workshops, palestras, cursos e eventos educacionais.",
    },
    {
        "name": "Pet Friendly",
        "icon": "🐾",
        "color_hex": "#78716C",
        "description": "Eventos que permitem e celebram a presença de animais de estimação.",
    },
    {
        "name": "LGBTQIA+",
        "icon": "🏳️‍🌈",
        "color_hex": "#F43F5E",
        "description": "Eventos inclusivos e celebrações da comunidade LGBTQIA+.",
    },
    {
        "name": "Arte Urbana",
        "icon": "🎨",
        "color_hex": "#F59E0B",
        "description": "Graffiti, street art, performances urbanas e intervenções artísticas.",
    },
    {
        "name": "Infantil / Família",
        "icon": "👶",
        "color_hex": "#FB923C",
        "description": "Eventos voltados para crianças e famílias.",
    },
    {
        "name": "Networking / Empreendedorismo",
        "icon": "💼",
        "color_hex": "#0EA5E9",
        "description": "Meetups, eventos de networking, startups e empreendedorismo.",
    },
    {
        "name": "Religioso / Espiritual",
        "icon": "🙏",
        "color_hex": "#A78BFA",
        "description": "Eventos religiosos, espirituais e práticas meditativas.",
    },
    {
        "name": "Jogos / Geek / Nerd",
        "icon": "🎲",
        "color_hex": "#34D399",
        "description": "Board games, RPG, cosplay, eventos de games e cultura geek.",
    },
]


class Command(BaseCommand):
    help = "Seed all predefined event categories into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Update existing categories even if they already exist.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        created_count = 0
        updated_count = 0

        for data in CATEGORIES:
            slug = slugify(data["name"])
            category, created = Category.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": data["name"],
                    "icon": data["icon"],
                    "color_hex": data["color_hex"],
                    "description": data["description"],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  ✓ Created: {data['icon']} {data['name']}"))
            elif force:
                category.name = data["name"]
                category.icon = data["icon"]
                category.color_hex = data["color_hex"]
                category.description = data["description"]
                category.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f"  ↺ Updated: {data['icon']} {data['name']}"))
            else:
                self.stdout.write(f"  — Skipped (already exists): {data['icon']} {data['name']}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {created_count} created, {updated_count} updated, "
                f"{len(CATEGORIES) - created_count - updated_count} skipped."
            )
        )
