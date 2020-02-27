import sys, os

# add parent of backend directory to sys.path
# to allow importing code from ../models directory via `import backend.models`

dirname = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(dirname)
