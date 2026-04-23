import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './PageTransition.module.scss';

const variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

interface Props {
  locationKey: string;
  children: ReactNode;
}

export default function PageTransition({ locationKey, children }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={locationKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={styles.wrapper}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
