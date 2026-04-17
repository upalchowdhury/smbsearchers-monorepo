# Make this directory importable as 'scraper_pkg' from run.py
from importlib import import_module
import sys, os

# Allow `from .adapters.xxx import ...` style imports when run from CLI
_parent = os.path.dirname(os.path.abspath(__file__))
if _parent not in sys.path:
    sys.path.insert(0, _parent)
