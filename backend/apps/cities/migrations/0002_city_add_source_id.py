from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cities", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="city",
            name="source_id",
            field=models.CharField(
                blank=True,
                help_text="IBGE source id (código IBGE do município)",
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
    ]
